<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\{
    Quote,
    Client,
    Product,
    Currency,
    TaxRate,
    Order,
    User,
    Promotion
};
use App\Services\PromotionQuoteService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;
use App\Actions\ConvertQuoteToInvoiceAction;

class QuoteController extends Controller
{
    /* -----------------------------------------------------------------
     | INDEX
     |-----------------------------------------------------------------*/
    public function index(Request $request): Response
    {
        $query = Quote::with(['client', 'user', 'currency'])
            ->withCount('items');

        /* Filtres */
        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(fn ($q) => $q
                ->where('quote_number', 'like', "%{$search}%")
                ->orWhereHas('client', fn ($c) =>
                    $c->where('company_name', 'like', "%{$search}%")));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('client_id')) {
            $query->where('client_id', $request->integer('client_id'));
        }

        $quotes = $query->latest()
            ->paginate($request->integer('per_page', 15))
            ->appends($request->all());

        return Inertia::render('Quotes/Index', [
            'quotes'  => $quotes,
            'filters' => $request->only(['search', 'status', 'client_id']),
            'clients' => Client::active()
                ->orderBy('company_name')
                ->get(['id', 'company_name']),
        ]);
    }

    /* -----------------------------------------------------------------
     | CREATE (formulaire  duplication)
     |-----------------------------------------------------------------*/
    public function create(Request $request): Response
    {
        $duplicateQuote = null;

        if ($request->filled('duplicate')) {
            /** @var Quote $src */
            $src = Quote::with('items.product.taxRate')
                        ->findOrFail($request->integer('duplicate'));

            $duplicateQuote = [
                'client_id'        => $src->client_id,
                'currency_code'    => $src->currency_code,
                // Carbon-safe
                'quote_date'       => ($src->quote_date  instanceof Carbon ? $src->quote_date  : Carbon::parse($src->quote_date))->format('Y-m-d'),
                'valid_until'      => ($src->valid_until instanceof Carbon ? $src->valid_until : Carbon::parse($src->valid_until))->format('Y-m-d'),
                'terms_conditions' => $src->terms_conditions,
                'notes'            => $src->notes,
                'internal_notes'   => $src->internal_notes,
                'items'            => $src->items->map(fn ($it) => [
                    'product_id'    => (string) $it->product_id,
                    'quantity'      => (float)  $it->quantity,
                    'unit_price_ht' => (float) ($it->unit_price_ht_snapshot
                                         ?? $it->product->price_ht
                                         ?? 0),
                    'tax_rate'      => (float) ($it->tax_rate_snapshot
                                         ?? optional($it->product->taxRate)->rate
                                         ?? 0),
                ]),
            ];
        }

        return Inertia::render('Quotes/Create', [
            'clients'        => Client::active()->orderBy('company_name')->get(),
            'products'       => Product::with(['brand','category','currency','taxRate'])
                                       ->where('is_active', true)
                                       ->orderBy('name')
                                       ->get(),
            'currencies'     => Currency::all(),
            'taxRates'       => TaxRate::all(),
            'duplicateQuote' => $duplicateQuote,
        ]);
    }

    /* -----------------------------------------------------------------
     | STORE
     |-----------------------------------------------------------------*/
    public function store(Request $request, PromotionQuoteService $promoSrv): RedirectResponse
    {
        $data = $request->validate([
            'client_id'             => 'required|exists:clients,id',
            'quote_date'            => 'required|date',
            'valid_until'           => 'required|date|after:quote_date',
            'currency_code'         => 'required|exists:currencies,code',
            'terms_conditions'      => 'nullable|string',
            'notes'                 => 'nullable|string',
            'internal_notes'        => 'nullable|string',
            'promo_code'            => 'nullable|string|max:64',
            'items'                 => 'required|array|min:1',
            'items.*.product_id'    => 'required|exists:products,id',
            'items.*.quantity'      => 'required|numeric|min:0.01',
            'items.*.unit_price_ht' => 'required|numeric|min:0',
            'items.*.tax_rate'      => 'required|numeric|min:0|max:100',
        ]);

        $client = Client::findOrFail($data['client_id']);

        /** @var Quote $quote */
        $quote = DB::transaction(function () use ($data, $client, $promoSrv) {
            // 1) Devis
            $quote = Quote::create([
                'client_id'        => $data['client_id'],
                'user_id'          => Auth::id(),
                'quote_date'       => $data['quote_date'],
                'valid_until'      => $data['valid_until'],
                'currency_code'    => $data['currency_code'],
                'terms_conditions' => $data['terms_conditions'] ?? null,
                'notes'            => $data['notes'] ?? null,
                'internal_notes'   => $data['internal_notes'] ?? null,
                'client_snapshot'  => $client->toSnapshot(),
                'discount_total'     => 0,
                'applied_promotions' => [],
            ]);

            // 2) Lignes
            foreach ($data['items'] as $i => $item) {
                $product = Product::with('taxRate')->findOrFail($item['product_id']);

                $quote->items()->create([
                    'product_id'                   => $product->id,
                    'product_name_snapshot'        => $product->name,
                    'product_description_snapshot' => $product->description,
                    'product_sku_snapshot'         => $product->sku,
                    'unit_price_ht_snapshot'       => $item['unit_price_ht'],
                    'tax_rate_snapshot'            => $item['tax_rate'],
                    'quantity'                     => $item['quantity'],
                    'sort_order'                   => $i,
                    'discount_amount'              => 0,
                ]);
            }

            // 3) Preview promos depuis payload
            $payload = [
                'client_id'     => $data['client_id'],
                'currency_code' => $data['currency_code'],
                'items'         => array_map(fn ($it) => [
                    'product_id'    => (string)$it['product_id'],
                    'quantity'      => (float)$it['quantity'],
                    'unit_price_ht' => (float)$it['unit_price_ht'],
                    'tax_rate'      => (float)$it['tax_rate'],
                ], $data['items']),
            ];
            $code    = $data['promo_code'] ?? null;

            $preview = $promoSrv->previewFromPayload($payload, $code, Auth::id());

            // 4) Ventilation par ligne
            $lines = $preview['lines_total_discounts'] ?? [];
            $items = $quote->items()->orderBy('sort_order')->get()->values();
            foreach ($items as $idx => $item) {
                $disc = (float)($lines[$idx] ?? 0);
                if ($disc > 0) {
                    $item->update(['discount_amount' => round($disc, 2)]);
                }
            }

            // 5) Persist total + promos
            $quote->discount_total     = (float)($preview['discount_total'] ?? 0);
            $quote->applied_promotions = $preview['applied_promotions'] ?? [];
            $quote->save();

            // 6) Totaux après remise
            $quote->calculateTotalsWithDiscount();

            return $quote;
        });

        return redirect()
            ->route('quotes.show', $quote)
            ->with('success', 'Devis créé avec succès.');
    }

    /* -----------------------------------------------------------------
     | SHOW
     |-----------------------------------------------------------------*/
    public function show(Quote $quote): Response
    {
        $quote->load([
            'client','user','currency',
            'items.product','statusHistories.user','order',
        ]);

        /* Rendre visibles les champs snapshot / montants */
        $quote->items->each->makeVisible([
            'unit_price_ht_snapshot','tax_rate_snapshot',
            'quantity','line_total_ht','line_tax_amount',
            'line_total_ttc','sort_order',
        ]);

        /* Fallback si snapshot manquant */
        $quote->items->each(function ($item) {
            if (is_null($item->unit_price_ht_snapshot)) {
                $item->unit_price_ht_snapshot = (float) ($item->product->price_ht ?? 0);
            }
            if (is_null($item->tax_rate_snapshot)) {
                $item->tax_rate_snapshot =
                    (float) optional($item->product->taxRate)->rate ?? 0;
            }
        });

        /* ─────────────────────────────────────────────────────────────
         | Enrichir les promotions pour l'affichage :
         |  - Injecter hint {type,value} depuis promotion_actions
         |  - Ventiler discount_amount par ligne (si manquant)
         * ────────────────────────────────────────────────────────────*/
        $applied = $quote->applied_promotions ?? [];

        // 1) Construire map promo_id -> hint depuis la première action
        $ids = collect($applied)->pluck('promotion_id')->filter()->unique();
        $hints = [];
        if ($ids->isNotEmpty()) {
            $promos = Promotion::with(['actions' => function ($q) {
                $q->orderBy('id'); // première action = principale
            }])->whereIn('id', $ids)->get();

            foreach ($promos as $p) {
                $act = $p->actions->first();
                if ($act) {
                    $hints[$p->id] = [
                        'type'  => $act->action_type,          // 'percent' | 'fixed' | ...
                        'value' => (float) $act->value,
                    ];
                }
            }
        }

        // 2) Injecter hint si absent
        foreach ($applied as &$ap) {
            if (!isset($ap['hint']) && isset($hints[$ap['promotion_id']])) {
                $ap['hint'] = $hints[$ap['promotion_id']];
            }
        }
        unset($ap);
        $quote->applied_promotions = $applied;

        // 3) Ventiler par ligne pour l’UI (sans persister)
        $perLine = [];
        foreach ($applied as $ap) {
            foreach (($ap['lines_breakdown'] ?? []) as $lb) {
                $i = (int) ($lb['index'] ?? -1);
                $amt = (float) ($lb['amount'] ?? 0);
                if ($i < 0 || $amt <= 0) continue;
                $perLine[$i] = ($perLine[$i] ?? 0) + $amt;
            }
        }
        foreach ($quote->items as $i => $it) {
            $it->makeVisible(['discount_amount']);
            // si déjà stocké (devis récents), on garde la valeur DB ; sinon on expose la ventilation
            $current = (float) ($it->discount_amount ?? 0);
            if ($current <= 0 && isset($perLine[$i])) {
                $it->setAttribute('discount_amount', (float) $perLine[$i]);
            }
        }

        return Inertia::render('Quotes/Show', ['quote' => $quote]);
    }

    /* -----------------------------------------------------------------
     | EDIT
     |-----------------------------------------------------------------*/
    public function edit(Quote $quote): Response|RedirectResponse
    {
        if ($quote->status !== 'draft') {
            return redirect()
                ->route('quotes.show', $quote)
                ->with('error', 'Seuls les devis en brouillon peuvent être modifiés.');
        }

        $quote->load(['client','items.product']);

        return Inertia::render('Quotes/Edit', [
            'quote'      => $quote,
            'clients'    => Client::active()->orderBy('company_name')->get(),
            'products'   => Product::with(['brand','category','currency','taxRate'])
                                   ->where('is_active', true)
                                   ->orderBy('name')
                                   ->get(),
            'currencies' => Currency::all(),
            'taxRates'   => TaxRate::all(),
        ]);
    }

    /* -----------------------------------------------------------------
     | UPDATE
     |-----------------------------------------------------------------*/
    public function update(Request $request, Quote $quote, PromotionQuoteService $promoSrv): RedirectResponse
    {
        if ($quote->status !== 'draft') {
            return back()->with('error', 'Seuls les devis en brouillon peuvent être modifiés.');
        }

        $data = $request->validate([
            'client_id'             => 'required|exists:clients,id',
            'quote_date'            => 'required|date',
            'valid_until'           => 'required|date|after:quote_date',
            'currency_code'         => 'required|exists:currencies,code',
            'terms_conditions'      => 'nullable|string',
            'notes'                 => 'nullable|string',
            'internal_notes'        => 'nullable|string',
            'promo_code'            => 'nullable|string|max:64',
            'items'                 => 'required|array|min:1',
            'items.*.product_id'    => 'required|exists:products,id',
            'items.*.quantity'      => 'required|numeric|min:0.01',
            'items.*.unit_price_ht' => 'required|numeric|min:0',
            'items.*.tax_rate'      => 'required|numeric|min:0|max:100',
        ]);

        $client = Client::findOrFail($data['client_id']);

        DB::transaction(function () use ($data, $client, $quote, $promoSrv) {
            // 1) Maj devis + reset remises
            $quote->update([
                'client_id'        => $data['client_id'],
                'quote_date'       => $data['quote_date'],
                'valid_until'      => $data['valid_until'],
                'currency_code'    => $data['currency_code'],
                'terms_conditions' => $data['terms_conditions'] ?? null,
                'notes'            => $data['notes'] ?? null,
                'internal_notes'   => $data['internal_notes'] ?? null,
                'client_snapshot'  => $client->toSnapshot(),
                'discount_total'     => 0,
                'applied_promotions' => [],
            ]);

            // 2) Remplacer les items
            $quote->items()->delete();

            foreach ($data['items'] as $i => $item) {
                $product = Product::with('taxRate')->findOrFail($item['product_id']);

                $quote->items()->create([
                    'product_id'                   => $product->id,
                    'product_name_snapshot'        => $product->name,
                    'product_description_snapshot' => $product->description,
                    'product_sku_snapshot'         => $product->sku,
                    'unit_price_ht_snapshot'       => $item['unit_price_ht'],
                    'tax_rate_snapshot'            => $item['tax_rate'],
                    'quantity'                     => $item['quantity'],
                    'sort_order'                   => $i,
                    'discount_amount'              => 0,
                ]);
            }

            // 3) Preview promos
            $payload = [
                'client_id'     => $data['client_id'],
                'currency_code' => $data['currency_code'],
                'items'         => array_map(fn ($it) => [
                    'product_id'    => (string)$it['product_id'],
                    'quantity'      => (float)$it['quantity'],
                    'unit_price_ht' => (float)$it['unit_price_ht'],
                    'tax_rate'      => (float)$it['tax_rate'],
                ], $data['items']),
            ];
            $code    = $data['promo_code'] ?? null;

            $preview = $promoSrv->previewFromPayload($payload, $code, Auth::id());

            // 4) Ventilation par ligne
            $lines = $preview['lines_total_discounts'] ?? [];
            $items = $quote->items()->orderBy('sort_order')->get()->values();
            foreach ($items as $idx => $item) {
                $disc = (float)($lines[$idx] ?? 0);
                if ($disc > 0) {
                    $item->update(['discount_amount' => round($disc, 2)]);
                }
            }

            // 5) Total + promos
            $quote->discount_total     = (float)($preview['discount_total'] ?? 0);
            $quote->applied_promotions = $preview['applied_promotions'] ?? [];
            $quote->save();

            // 6) Totaux après remise
            $quote->calculateTotalsWithDiscount();
        });

        return redirect()
            ->route('quotes.show', $quote)
            ->with('success', 'Devis mis à jour avec succès.');
    }

    /* -----------------------------------------------------------------
     | DESTROY
     |-----------------------------------------------------------------*/
    public function destroy(Quote $quote): RedirectResponse
    {
        if (!in_array($quote->status, ['draft', 'rejected'], true)) {
            return back()->with('error', 'Seuls les devis en brouillon ou refusés peuvent être supprimés.');
        }

        $quote->delete();

        return redirect()
            ->route('quotes.index')
            ->with('success', 'Devis supprimé.');
    }

    /* -----------------------------------------------------------------
     | CHANGE STATUS
     |-----------------------------------------------------------------*/
    public function changeStatus(Request $request, Quote $quote): RedirectResponse
    {
        $data = $request->validate([
            'status'  => 'required|string',
            'comment' => 'nullable|string',
        ]);

        $ok = $quote->changeStatus($data['status'], Auth::user(), $data['comment'] ?? null);

        return back()->with(
            $ok ? 'success' : 'error',
            $ok ? 'Statut du devis mis à jour.' : 'Transition de statut non autorisée.'
        );
    }

    /* -----------------------------------------------------------------
     | CONVERT TO ORDER
     |-----------------------------------------------------------------*/
    public function convertToOrder(Quote $quote): RedirectResponse
     {
         if (!$quote->can_be_converted) {
             return back()->with('error', 'Ce devis ne peut pas être converti en commande.');
         }

         $order = $quote->convertToOrder(Auth::user());

         if (!$order) {
             return back()->with('error', 'Erreur lors de la conversion en commande.');
         }

         return redirect()
             ->route('orders.show', $order)
             ->with('success', "Devis converti en commande #{$order->order_number}");
     }

    /* -----------------------------------------------------------------
     | CONVERT TO INVOICE
     |-----------------------------------------------------------------*/
    public function convertToInvoice(Request $request, Quote $quote, ConvertQuoteToInvoiceAction $convertAction): RedirectResponse
    {
        if ($quote->status !== 'accepted') {
            return redirect()
                ->route('quotes.show', $quote)
                ->with('error', 'Seuls les devis acceptés peuvent être convertis en facture');
        }

        $validated = $request->validate([
            'invoice_date' => 'required|date',
            'invoice_due_date' => 'required|date|after_or_equal:invoice_date',
            'invoice_notes' => 'nullable|string',
        ]);

        try {
            DB::transaction(function () use ($quote, $validated, $convertAction) {
                $quote->load('items.product');

                $invoice = $convertAction->handle($quote, [
                    'date' => $validated['invoice_date'],
                    'due_date' => $validated['invoice_due_date'],
                    'notes' => $validated['invoice_notes'],
                ]);

                $quote->statusHistories()->create([
                    'from_status' => 'accepted',
                    'to_status' => 'converted',
                    'comment' => 'Converti en facture #' . $invoice->number,
                    'user_id' => Auth::id(),
                ]);

                $quote->update([
                    'status' => 'converted',
                    'converted_at' => now(),
                ]);
            });

            return redirect()
                ->route('quotes.show', $quote)
                ->with('success', 'Devis converti en facture avec succès');

        } catch (\Exception $e) {
            Log::error('Erreur conversion devis vers facture', [
                'quote_id' => $quote->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return redirect()
                ->route('quotes.show', $quote)
                ->with('error', 'Erreur lors de la conversion : ' . $e->getMessage());
        }
    }

    /* -----------------------------------------------------------------
     | DUPLICATE (redirection vers create)
     |-----------------------------------------------------------------*/
    public function duplicate(Quote $quote): RedirectResponse
    {
        return redirect()->route('quotes.create', ['duplicate' => $quote->id]);
    }

    /* -----------------------------------------------------------------
     | EXPORT PDF
     |-----------------------------------------------------------------*/
    public function export(Quote $quote)
    {
        $quote->load(['client', 'items.product', 'currency']);

        $pdf = Pdf::loadView('pdf.quote', compact('quote'));

        return $pdf->stream("Devis_{$quote->quote_number}.pdf");
    }
}
