<?php

namespace App\Http\Controllers;

use App\Http\Requests\StockMovementRequest;
use App\Models\{
    StockMovement,
    StockMovementAttachment,
    Product,
    Currency,
    Provider,
    StockMovementReason
};
use Illuminate\Http\{
    Request,
    RedirectResponse
};
use Illuminate\Support\Facades\{
    Auth,
    Storage,
    DB
};
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class StockMovementController extends Controller
{
    /* -----------------------------------------------------------------
     |  LISTE + FILTRES
     |----------------------------------------------------------------- */
    public function index(Request $request): Response
    {
        $query = StockMovement::query()
            ->with([
                'product:id,name,sku',
                'user:id,name',
                'currency:code,symbol',
                'attachments',
                'provider:id,name',
                'movementReason:id,name',
            ])
            ->withTrashed(); // inclure soft-deleted

        /* -------- filtres dynamiques -------- */
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('reference', 'like', "%{$search}%")
                  ->orWhere('supplier',  'like', "%{$search}%")
                  ->orWhere('reason',    'like', "%{$search}%");
            });
        }

        $query->when($request->filled('type'),
            fn ($q) => $q->where('type', $request->type));

        $query->when($request->filled('product_id'),
            fn ($q) => $q->where('product_id', $request->product_id));

        if ($request->filled(['start_date', 'end_date'])) {
            $query->whereBetween('movement_date', [
                $request->start_date . ' 00:00:00',
                $request->end_date   . ' 23:59:59',
            ]);
        }

        /* -------- tri + pagination -------- */
        $sort      = $request->input('sort',       'movement_date');
        $direction = $request->input('direction',  'desc');
        $perPage   = (int) $request->input('per_page', 10);

        $movements = $query->orderBy($sort, $direction)
                           ->paginate($perPage)
                           ->appends($request->all());

        /* -------- produits pour filtre -------- */
        $products = Product::select('id', 'name', 'sku')
                           ->orderBy('name')
                           ->get();

        return Inertia::render('StockMovements/Index', [
            'movements' => $movements,
            'products'  => $products,
            'filters'   => $request->only([
                'search', 'type', 'product_id',
                'start_date', 'end_date',
                'sort', 'direction', 'per_page',
            ]),
        ]);
    }

    /* -----------------------------------------------------------------
     |  CRÉATION
     |----------------------------------------------------------------- */
    public function create(): Response
    {
        return Inertia::render('StockMovements/Create', [
            'products'   => Product::select('id', 'name', 'sku', 'stock_quantity')
                                   ->orderBy('name')->get(),
            'currencies' => Currency::all(['code', 'symbol']),
            'providers'  => Provider::active()->select('id', 'name')
                                   ->orderBy('name')->get(),
            'reasons'    => StockMovementReason::active()
                                   ->select('id', 'name', 'type')
                                   ->orderBy('name')->get(),
        ]);
    }

    public function store(StockMovementRequest $request): RedirectResponse
    {
        $data            = $request->validated();
        $data['user_id'] = Auth::id();

        $movement = StockMovement::create($data);

        /* pièces jointes */
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $path = $file->store("stock-movements/{$movement->id}", 'public');

                StockMovementAttachment::create([
                    'stock_movement_id' => $movement->id,
                    'filename'          => $file->getClientOriginalName(),
                    'path'              => $path,
                    'mime_type'         => $file->getMimeType(),
                    'size'              => $file->getSize(),
                ]);
            }
        }

        $this->updateProductStock($movement);

        return to_route('stock-movements.index')
            ->with('success', 'Mouvement de stock créé avec succès.');
    }

    /* -----------------------------------------------------------------
     |  AFFICHAGE / ÉDITION
     |----------------------------------------------------------------- */
    public function show(StockMovement $stockMovement): Response
    {
        $stockMovement->load([
            'product:id,name,sku,stock_quantity',
            'user:id,name',
            'attachments',
            'currency:code,symbol',
            'provider:id,name',
            'movementReason:id,name',
        ]);

        return Inertia::render('StockMovements/Show', [
            'movement' => $stockMovement,
        ]);
    }

    public function edit(StockMovement $stockMovement): Response
    {
        $stockMovement->load([
            'product:id,name,sku,stock_quantity',
            'attachments',
            'currency:code,symbol',
            'provider:id,name',
            'movementReason:id,name',
        ]);

        return Inertia::render('StockMovements/Edit', [
            'movement'   => $stockMovement,
            'products'   => Product::select('id', 'name', 'sku', 'stock_quantity')
                                   ->orderBy('name')->get(),
            'currencies' => Currency::all(['code', 'symbol']),
            'providers'  => Provider::active()->select('id', 'name')
                                   ->orderBy('name')->get(),
            'reasons'    => StockMovementReason::active()
                                   ->select('id', 'name', 'type')
                                   ->orderBy('name')->get(),
        ]);
    }

    public function update(
        StockMovementRequest $request,
        StockMovement        $stockMovement
    ): RedirectResponse {
        $data = $request->validated();

        /* annule l'ancien mouvement (stock) */
        $this->revertProductStock($stockMovement);

        /* mise à jour */
        $stockMovement->update($data);

        /* suppression des PJ */
        if ($request->filled('deleted_attachment_ids')) {
            StockMovementAttachment::whereIn('id', $request->deleted_attachment_ids)
                ->where('stock_movement_id', $stockMovement->id)
                ->each(function ($a) {
                    Storage::disk('public')->delete($a->path);
                    $a->delete();
                });
        }

        /* ajout de nouvelles PJ */
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $path = $file->store("stock-movements/{$stockMovement->id}", 'public');

                StockMovementAttachment::create([
                    'stock_movement_id' => $stockMovement->id,
                    'filename'          => $file->getClientOriginalName(),
                    'path'              => $path,
                    'mime_type'         => $file->getMimeType(),
                    'size'              => $file->getSize(),
                ]);
            }
        }

        /* applique le nouveau mouvement */
        $this->updateProductStock($stockMovement);

        return to_route('stock-movements.index')
            ->with('success', 'Mouvement de stock mis à jour avec succès.');
    }

    /* -----------------------------------------------------------------
     |  SOFT-DELETE / RESTORE / FORCE-DELETE
     |----------------------------------------------------------------- */
    public function destroy(StockMovement $stockMovement): RedirectResponse
    {
        $this->revertProductStock($stockMovement);
        $stockMovement->attachments()->delete();
        $stockMovement->delete();

        return back()->with('success', 'Mouvement de stock supprimé.');
    }

    public function restore(string $id): RedirectResponse
    {
        $movement = StockMovement::withTrashed()->findOrFail($id);
        $movement->restore();
        $movement->attachments()->withTrashed()->restore();

        $this->updateProductStock($movement);

        return back()->with('success', 'Mouvement de stock restauré.');
    }

    public function forceDelete(string $id): RedirectResponse
    {
        $movement = StockMovement::withTrashed()->findOrFail($id);

        $movement->attachments()->withTrashed()->each(function ($a) {
            Storage::disk('public')->delete($a->path);
            $a->forceDelete();
        });

        $movement->forceDelete();

        return back()->with('success', 'Mouvement supprimé définitivement.');
    }

    /* -----------------------------------------------------------------
     |  RAPPORT (compat Dashboard)
     |----------------------------------------------------------------- */
    public function report(Request $request): Response
    {
        // Période (par défaut 30 jours)
        $period = (int) $request->integer('period', 30);
        if ($period <= 0) $period = 30;

        $end   = Carbon::now()->endOfDay();
        $start = Carbon::now()->subDays($period - 1)->startOfDay();

        // Produits + catégorie (pour vue report)
        $products = Product::with(['category:id,name'])
            ->select('id', 'name', 'sku', 'stock_quantity', 'category_id')
            ->orderBy('name')
            ->get();

        // Totaux par produit sur la période
        $products = $products->map(function ($product) use ($start, $end) {
            $movements = StockMovement::where('product_id', $product->id)
                ->whereNull('deleted_at')
                ->whereBetween('movement_date', [$start, $end])
                ->get();

            $total_in = (int) $movements->where('type', 'in')->sum('quantity');
            $total_out = (int) $movements->where('type', 'out')->sum(function ($m) {
                return abs($m->quantity);
            });
            $total_adjustments = (int) $movements->where('type', 'adjustment')->sum('quantity');

            $product->total_in = $total_in;
            $product->total_out = $total_out;
            $product->total_adjustments = $total_adjustments;

            return $product;
        });

        // Statistiques globales
        $globalStats = [
            'total_products'      => $products->count(),
            'total_stock'         => (int) $products->sum('stock_quantity'),
            'low_stock_count'     => $products->where('stock_quantity', '<', 10)->count(),
            'out_of_stock_count'  => $products->where('stock_quantity', 0)->count(),
            'total_in'            => (int) $products->sum('total_in'),
            'total_out'           => (int) $products->sum('total_out'),
            'total_adjustments'   => (int) $products->sum('total_adjustments'),
        ];

        // KPIs pour le Dashboard
        $kpis = [
            'total_in'            => ['value' => $globalStats['total_in']],
            'total_out'           => ['value' => $globalStats['total_out']],
            'net_change'          => ['value' => $globalStats['total_in'] - $globalStats['total_out']],
            'total_stock'         => ['value' => $globalStats['total_stock']],
            'total_products'      => ['value' => $globalStats['total_products']],
            'low_stock_count'     => ['value' => $globalStats['low_stock_count']],
            'out_of_stock_count'  => ['value' => $globalStats['out_of_stock_count']],
        ];

        // Série journalière des mouvements
        $raw = StockMovement::selectRaw("
                DATE(movement_date) as d,
                SUM(CASE WHEN type='in' THEN quantity ELSE 0 END) as total_in,
                SUM(CASE WHEN type='out' THEN ABS(quantity) ELSE 0 END) as total_out,
                SUM(CASE WHEN type='adjustment' THEN quantity ELSE 0 END) as total_adj
            ")
            ->whereNull('deleted_at')
            ->whereBetween('movement_date', [$start, $end])
            ->groupBy('d')
            ->orderBy('d')
            ->get()
            ->keyBy('d');

        $movementsChart = [];
        $cursor = $start->copy();
        while ($cursor->lte($end)) {
            $day = $cursor->toDateString();
            $row = $raw->get($day);

            $in  = (int) ($row->total_in  ?? 0);
            $out = (int) ($row->total_out ?? 0);
            $adj = (int) ($row->total_adj ?? 0);

            $movementsChart[] = [
                'date'        => $day,
                'label'       => $cursor->format('d/m'),
                'in'          => $in,
                'out'         => $out,
                'adjustments' => $adj,
                'net'         => $in - $out + $adj,
            ];

            $cursor->addDay();
        }

        // Top produits plus mouvants
        $topMoving = StockMovement::query()
            ->selectRaw('product_id,
                SUM(CASE WHEN type="in" THEN quantity ELSE 0 END) as in_qty,
                SUM(CASE WHEN type="out" THEN ABS(quantity) ELSE 0 END) as out_qty,
                SUM(CASE WHEN type="adjustment" THEN quantity ELSE 0 END) as adj_qty')
            ->whereNull('deleted_at')
            ->whereBetween('movement_date', [$start, $end])
            ->groupBy('product_id')
            ->orderByRaw('(ABS(SUM(CASE WHEN type="in" THEN quantity ELSE 0 END) - SUM(CASE WHEN type="out" THEN ABS(quantity) ELSE 0 END) + SUM(CASE WHEN type="adjustment" THEN quantity ELSE 0 END))) DESC')
            ->limit(10)
            ->get()
            ->map(function ($row) {
                $p = Product::select('id','name','sku','category_id')->with(['category:id,name'])->find($row->product_id);
                return [
                    'id'   => $p?->id,
                    'name' => $p?->name ?? 'Produit supprimé',
                    'sku'  => $p?->sku,
                    'in'   => (int) $row->in_qty,
                    'out'  => (int) $row->out_qty,
                    'net'  => (int) ($row->in_qty - $row->out_qty + $row->adj_qty),
                    'category' => $p && $p->category ? ['name' => $p->category->name] : null,
                ];
            })
            ->values();

        // Activité récente
        $recentMovements = StockMovement::with(['product:id,name,sku'])
            ->whereNull('deleted_at')
            ->orderByDesc('movement_date')
            ->limit(10)
            ->get()
            ->map(function ($m) {
                return [
                    'id'           => $m->id,
                    'type'         => $m->type, // 'in' | 'out' | 'adjustment'
                    'product_name' => $m->product->name ?? '—',
                    'sku'          => $m->product->sku ?? null,
                    'quantity'     => (int) $m->quantity,
                    'reason'       => $m->reason ?? null,
                    'created_at'   => optional($m->movement_date)->toDateTimeString(),
                ];
            });

        // Répartition par catégorie (stock courant)
        $categoryBalances = Product::with('category:id,name')
            ->select('id','stock_quantity','category_id')
            ->get()
            ->groupBy(fn($p) => $p->category->name ?? 'Sans catégorie')
            ->map(function ($group, $name) {
                return [
                    'name'  => $name,
                    'stock' => (int) $group->sum('stock_quantity'),
                ];
            })
            ->values();

        return Inertia::render('StockMovements/Report', [
            // Pour la vue Report
            'products'          => $products,
            'globalStats'       => $globalStats,

            // Pour le Dashboard embarqué
            'period'            => (string) $period,
            'kpis'              => $kpis,
            'movementsChart'    => $movementsChart,
            'topMoving'         => $topMoving,
            'recentMovements'   => $recentMovements,
            'categoryBalances'  => $categoryBalances,
        ]);
    }

    public function export(Request $request)
    {
        return response()->json(['message' => 'Export en cours de développement']);
    }

    /* -----------------------------------------------------------------
     |  HELPERS internes
     |----------------------------------------------------------------- */
    private function updateProductStock(StockMovement $m): void
    {
        // Empêche le stock de devenir négatif si la colonne est UNSIGNED
        if ($m->quantity >= 0) {
            $m->product->increment('stock_quantity', $m->quantity);
        } else {
            // quantité négative ⇒ décrémente
            $m->product->decrement('stock_quantity', abs($m->quantity));
        }
    }

    private function revertProductStock(StockMovement $m): void
    {
        // Annulation : on fait l'inverse exact de updateProductStock
        if ($m->quantity >= 0) {
            $m->product->decrement('stock_quantity', $m->quantity);
        } else {
            $m->product->increment('stock_quantity', abs($m->quantity));
        }
    }
}
