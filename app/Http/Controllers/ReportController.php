<?php

namespace App\Http\Controllers;

use App\Models\{Product, Client, Quote, Order, Invoice, StockMovement, Category};
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Reports/Index');
    }

    /**
     * Rapport de ventes détaillé
     */
    public function sales(Request $request): Response
    {
        $filters = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'client_id' => 'nullable|exists:clients,id',
            'category_id' => 'nullable|exists:categories,id',
            'product_id' => 'nullable|exists:products,id',
        ]);

        $startDate = Carbon::parse($filters['start_date']);
        $endDate = Carbon::parse($filters['end_date']);

        // Ventes par période
        $salesByPeriod = $this->getSalesByPeriod($startDate, $endDate, $filters);
        
        // Top clients
        $topClients = $this->getTopClients($startDate, $endDate, $filters);
        
        // Top produits
        $topProducts = $this->getTopProductsDetailed($startDate, $endDate, $filters);
        
        // Analyse par catégorie
        $categoryAnalysis = $this->getCategoryAnalysis($startDate, $endDate, $filters);

        return Inertia::render('Reports/Sales', [
            'salesByPeriod' => $salesByPeriod,
            'topClients' => $topClients,
            'topProducts' => $topProducts,
            'categoryAnalysis' => $categoryAnalysis,
            'filters' => $filters,
            'clients' => Client::active()->orderBy('company_name')->get(['id', 'company_name']),
            'categories' => Category::active()->orderBy('name')->get(['id', 'name']),
            'products' => Product::active()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /**
     * Rapport de stock détaillé
     */
    public function inventory(Request $request): Response
    {
        $filters = $request->validate([
            'category_id' => 'nullable|exists:categories,id',
            'low_stock_only' => 'nullable|boolean',
            'out_of_stock_only' => 'nullable|boolean',
        ]);

        $query = Product::with(['category', 'brand'])
            ->where('track_inventory', true);

        if ($filters['category_id']) {
            $query->where('category_id', $filters['category_id']);
        }

        if ($filters['low_stock_only']) {
            $query->whereColumn('stock_quantity', '<=', 'low_stock_threshold');
        }

        if ($filters['out_of_stock_only']) {
            $query->where('stock_quantity', 0);
        }

        $products = $query->get()->map(function ($product) {
            // Calcul de la valeur du stock
            $stockValue = $product->stock_quantity * $product->cost_price;
            
            // Mouvements récents
            $recentMovements = StockMovement::where('product_id', $product->id)
                ->where('movement_date', '>=', now()->subDays(30))
                ->count();

            return [
                'id' => $product->id,
                'name' => $product->name,
                'sku' => $product->sku,
                'category' => $product->category?->name,
                'brand' => $product->brand?->name,
                'stock_quantity' => $product->stock_quantity,
                'low_stock_threshold' => $product->low_stock_threshold,
                'cost_price' => $product->cost_price,
                'stock_value' => $stockValue,
                'recent_movements' => $recentMovements,
                'status' => $this->getStockStatus($product),
            ];
        });

        // Statistiques globales
        $totalStockValue = $products->sum('stock_value');
        $lowStockCount = $products->where('status', 'low')->count();
        $outOfStockCount = $products->where('status', 'out')->count();

        return Inertia::render('Reports/Inventory', [
            'products' => $products,
            'totalStockValue' => $totalStockValue,
            'lowStockCount' => $lowStockCount,
            'outOfStockCount' => $outOfStockCount,
            'filters' => $filters,
            'categories' => Category::active()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /**
     * Rapport financier
     */
    public function financial(Request $request): Response
    {
        $filters = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $startDate = Carbon::parse($filters['start_date']);
        $endDate = Carbon::parse($filters['end_date']);

        // Revenus par mois
        $monthlyRevenue = $this->getMonthlyRevenue($startDate, $endDate);
        
        // Analyse des marges
        $marginAnalysis = $this->getMarginAnalysis($startDate, $endDate);
        
        // Créances clients
        $receivables = $this->getReceivables();
        
        // Analyse des paiements
        $paymentAnalysis = $this->getPaymentAnalysis($startDate, $endDate);

        return Inertia::render('Reports/Financial', [
            'monthlyRevenue' => $monthlyRevenue,
            'marginAnalysis' => $marginAnalysis,
            'receivables' => $receivables,
            'paymentAnalysis' => $paymentAnalysis,
            'filters' => $filters,
        ]);
    }

    // Méthodes helper privées
    private function getSalesByPeriod(Carbon $start, Carbon $end, array $filters): array
    {
        $query = Order::select(
                DB::raw('DATE(order_date) as date'),
                DB::raw('COUNT(*) as orders_count'),
                DB::raw('SUM(total_ttc) as revenue')
            )
            ->whereBetween('order_date', [$start, $end]);

        if ($filters['client_id']) {
            $query->where('client_id', $filters['client_id']);
        }

        return $query->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(function ($item) {
                return [
                    'date' => $item->date,
                    'orders_count' => (int) $item->orders_count,
                    'revenue' => (float) $item->revenue,
                ];
            })
            ->toArray();
    }

    private function getStockStatus(Product $product): string
    {
        if ($product->stock_quantity === 0) return 'out';
        if ($product->stock_quantity <= $product->low_stock_threshold) return 'low';
        return 'ok';
    }

    private function getMonthlyRevenue(Carbon $start, Carbon $end): array
    {
        return Invoice::select(
                DB::raw('DATE_FORMAT(date, "%Y-%m") as month'),
                DB::raw('SUM(total_ttc) as revenue'),
                DB::raw('COUNT(*) as invoices_count')
            )
            ->where('status', 'paid')
            ->whereBetween('date', [$start, $end])
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->toArray();
    }

    private function getMarginAnalysis(Carbon $start, Carbon $end): array
    {
        // Calcul des marges par produit vendu
        return DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->select(
                'products.name',
                DB::raw('SUM(order_items.quantity * order_items.unit_price_ht_snapshot) as revenue'),
                DB::raw('SUM(order_items.quantity * products.cost_price) as cost'),
                DB::raw('SUM(order_items.quantity * (order_items.unit_price_ht_snapshot - products.cost_price)) as margin')
            )
            ->whereBetween('orders.order_date', [$start, $end])
            ->groupBy('products.id', 'products.name')
            ->orderByDesc('margin')
            ->limit(20)
            ->get()
            ->toArray();
    }

    private function getReceivables(): array
    {
        return Invoice::with('client')
            ->whereIn('status', ['sent', 'issued', 'partially_paid'])
            ->orderBy('due_date')
            ->get()
            ->map(function ($invoice) {
                return [
                    'invoice_number' => $invoice->number,
                    'client_name' => $invoice->client->company_name,
                    'amount' => $invoice->total_ttc,
                    'due_date' => $invoice->due_date->toDateString(),
                    'days_overdue' => $invoice->isOverdue() ? $invoice->due_date->diffInDays(now()) : 0,
                    'is_overdue' => $invoice->isOverdue(),
                ];
            })
            ->toArray();
    }

    private function getPaymentAnalysis(Carbon $start, Carbon $end): array
    {
        return Invoice::select('status', DB::raw('COUNT(*) as count'), DB::raw('SUM(total_ttc) as amount'))
            ->whereBetween('date', [$start, $end])
            ->groupBy('status')
            ->get()
            ->toArray();
    }

    private function getTopClients(Carbon $start, Carbon $end, array $filters): array
    {
        return Client::select('clients.*')
            ->selectRaw('SUM(orders.total_ttc) as total_spent')
            ->selectRaw('COUNT(orders.id) as orders_count')
            ->join('orders', 'clients.id', '=', 'orders.client_id')
            ->whereBetween('orders.order_date', [$start, $end])
            ->groupBy('clients.id')
            ->orderByDesc('total_spent')
            ->limit(10)
            ->get()
            ->toArray();
    }

    private function getTopProductsDetailed(Carbon $start, Carbon $end, array $filters): array
    {
        $query = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->select(
                'products.name',
                'products.sku',
                DB::raw('SUM(order_items.quantity) as total_quantity'),
                DB::raw('SUM(order_items.line_total_ttc) as total_revenue'),
                DB::raw('COUNT(DISTINCT orders.client_id) as unique_clients')
            )
            ->whereBetween('orders.order_date', [$start, $end]);

        if ($filters['category_id']) {
            $query->where('products.category_id', $filters['category_id']);
        }

        return $query->groupBy('products.id', 'products.name', 'products.sku')
            ->orderByDesc('total_revenue')
            ->limit(20)
            ->get()
            ->toArray();
    }

    private function getCategoryAnalysis(Carbon $start, Carbon $end, array $filters): array
    {
        return DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->join('categories', 'categories.id', '=', 'products.category_id')
            ->select(
                'categories.name',
                DB::raw('SUM(order_items.quantity) as total_quantity'),
                DB::raw('SUM(order_items.line_total_ttc) as total_revenue'),
                DB::raw('COUNT(DISTINCT products.id) as products_count')
            )
            ->whereBetween('orders.order_date', [$start, $end])
            ->groupBy('categories.id', 'categories.name')
            ->orderByDesc('total_revenue')
            ->get()
            ->toArray();
    }
}