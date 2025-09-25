<?php

namespace App\Http\Controllers;

use App\Models\{Product, Client, Quote, Order, Invoice, StockMovement, Category};
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $period = $request->input('period', '30'); // 7, 30, 90, 365 jours
        $startDate = Carbon::now()->subDays((int) $period);

        // KPIs principaux
        $kpis = $this->getMainKPIs($startDate);

        // Données pour graphiques
        $salesChart = $this->getSalesChartData($startDate);
        $topProducts = $this->getTopProducts($startDate);
        $stockAlerts = $this->getStockAlerts();
        $recentActivity = $this->getRecentActivity();
        $categoryDistribution = $this->getCategoryDistribution();
        $quoteConversionRate = $this->getQuoteConversionRate($startDate);

        // Nouveaux KPIs avancés
        $salesMetrics = $this->getSalesMetrics($startDate);
        $clientMetrics = $this->getClientMetrics($startDate);
        $inventoryMetrics = $this->getInventoryMetrics();
        $financialMetrics = $this->getFinancialMetrics($startDate);
        $performanceMetrics = $this->getPerformanceMetrics($startDate);
        $trendsData = $this->getTrendsData($startDate);
        $heatmapData = $this->getHeatmapData($startDate);

        return Inertia::render('dashboard', [
            'kpis' => $kpis,
            'salesChart' => $salesChart,
            'topProducts' => $topProducts,
            'stockAlerts' => $stockAlerts,
            'recentActivity' => $recentActivity,
            'categoryDistribution' => $categoryDistribution,
            'quoteConversionRate' => $quoteConversionRate,
            'salesMetrics' => $salesMetrics,
            'clientMetrics' => $clientMetrics,
            'inventoryMetrics' => $inventoryMetrics,
            'financialMetrics' => $financialMetrics,
            'performanceMetrics' => $performanceMetrics,
            'trendsData' => $trendsData,
            'heatmapData' => $heatmapData,
            'period' => $period,
        ]);
    }

    private function getMainKPIs(Carbon $startDate): array
    {
        $now = Carbon::now();
        $periodDays = $startDate->diffInDays($now);

        // Fenêtre courante
        $revenue = Invoice::where('status', 'paid')
            ->whereBetween('date', [$startDate, $now])
            ->sum('total_ttc');

        // Fenêtre précédente (même durée, immédiatement avant)
        $previousStart = $startDate->copy()->subDays($periodDays);
        $previousEnd = $startDate->copy();

        $previousRevenue = Invoice::where('status', 'paid')
            ->whereBetween('date', [$previousStart, $previousEnd])
            ->sum('total_ttc');

        // Fenêtre YoY (même plage mais décalée d'un an)
        $prevStartYoY = $startDate->copy()->subYear();
        $prevEndYoY   = $now->copy()->subYear();

        $previousRevenueYoY = Invoice::where('status', 'paid')
            ->whereBetween('date', [$prevStartYoY, $prevEndYoY])
            ->sum('total_ttc');

        // Commandes
        $ordersCount = Order::whereBetween('created_at', [$startDate, $now])->count();
        $previousOrdersCount = Order::whereBetween('created_at', [$previousStart, $previousEnd])->count();

        // Nouveaux clients
        $newClients = Client::whereBetween('created_at', [$startDate, $now])->count();
        $previousNewClients = Client::whereBetween('created_at', [$previousStart, $previousEnd])->count();

        // Produits en rupture (instantané)
        $outOfStock = Product::where('track_inventory', true)
            ->where('stock_quantity', 0)
            ->count();

        return [
            'revenue' => [
                'value' => $revenue,
                'previous' => $previousRevenue,
                'previous_yoy' => $previousRevenueYoY,
                'change_period' => $previousRevenue > 0 ? (($revenue - $previousRevenue) / $previousRevenue) * 100 : 0,
                'change_yoy' => $previousRevenueYoY > 0 ? (($revenue - $previousRevenueYoY) / $previousRevenueYoY) * 100 : 0,
                'formatted' => number_format($revenue, 2, ',', ' ') . ' MAD',
                'formatted_previous' => number_format($previousRevenue, 2, ',', ' ') . ' MAD',
                'formatted_previous_yoy' => number_format($previousRevenueYoY, 2, ',', ' ') . ' MAD',
            ],
            'orders' => [
                'value' => $ordersCount,
                'previous' => $previousOrdersCount,
                'change' => $previousOrdersCount > 0 ? (($ordersCount - $previousOrdersCount) / $previousOrdersCount) * 100 : 0,
            ],
            'newClients' => [
                'value' => $newClients,
                'previous' => $previousNewClients,
                'change' => $previousNewClients > 0 ? (($newClients - $previousNewClients) / $previousNewClients) * 100 : 0,
            ],
            'outOfStock' => [
                'value' => $outOfStock,
                'total' => Product::where('track_inventory', true)->count(),
            ],
        ];
    }

    private function getSalesMetrics(Carbon $startDate): array
    {
        $totalRevenue = Invoice::where('status', 'paid')->where('date', '>=', $startDate)->sum('total_ttc');
        $totalOrders = Order::where('created_at', '>=', $startDate)->count();
        $averageOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;

        $monthlyGrowth = $this->getMonthlyGrowth();

        $quoteBasedSales = Order::whereNotNull('quote_id')->where('created_at', '>=', $startDate)->count();
        $directSales = Order::whereNull('quote_id')->where('created_at', '>=', $startDate)->count();

        $avgConversionTime = DB::table('quotes')
            ->join('orders', 'quotes.id', '=', 'orders.quote_id')
            ->where('quotes.created_at', '>=', $startDate)
            ->selectRaw('AVG(DATEDIFF(orders.created_at, quotes.created_at)) as avg_days')
            ->value('avg_days') ?? 0;

        return [
            'averageOrderValue' => [
                'value' => $averageOrderValue,
                'formatted' => number_format($averageOrderValue, 2, ',', ' ') . ' MAD',
            ],
            'monthlyGrowth' => $monthlyGrowth,
            'salesChannels' => [
                'quote_based' => $quoteBasedSales,
                'direct' => $directSales,
                'total' => $quoteBasedSales + $directSales,
            ],
            'avgConversionTime' => round($avgConversionTime, 1),
        ];
    }

    // ... le reste de la classe ne change pas ...

    private function getClientMetrics(Carbon $startDate): array { /* inchangé */
        $activeClients = Client::whereHas('orders', function($q) use ($startDate) {
            $q->where('created_at', '>=', $startDate);
        })->count();

        $returningClients = Client::whereHas('orders', function($q) use ($startDate) {
            $q->where('created_at', '>=', $startDate);
        })->whereHas('orders', function($q) use ($startDate) {
            $q->where('created_at', '<', $startDate);
        })->count();

        $retentionRate = $activeClients > 0 ? ($returningClients / $activeClients) * 100 : 0;

        $topClients = Client::select('clients.*')
            ->selectRaw('SUM(orders.total_ttc) as total_spent')
            ->selectRaw('COUNT(orders.id) as orders_count')
            ->join('orders', 'clients.id', '=', 'orders.client_id')
            ->where('orders.created_at', '>=', $startDate)
            ->groupBy('clients.id')
            ->orderByDesc('total_spent')
            ->limit(5)
            ->get();

        $clientsByCity = Client::select('city', DB::raw('COUNT(*) as count'))
            ->whereHas('orders', function($q) use ($startDate) {
                $q->where('created_at', '>=', $startDate);
            })
            ->groupBy('city')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        return [
            'activeClients' => $activeClients,
            'retentionRate' => round($retentionRate, 1),
            'topClients' => $topClients,
            'clientsByCity' => $clientsByCity,
        ];
    }

    private function getInventoryMetrics(): array { /* inchangé */
        $totalStockValue = Product::where('track_inventory', true)
            ->selectRaw('SUM(stock_quantity * price) as total_value')
            ->value('total_value') ?? 0;

        $soldQuantity = DB::table('quote_items')
            ->join('quotes', 'quotes.id', '=', 'quote_items.quote_id')
            ->where('quotes.status', 'converted')
            ->where('quotes.created_at', '>=', Carbon::now()->subDays(365))
            ->sum('quote_items.quantity');

        $avgStock = Product::where('track_inventory', true)->avg('stock_quantity') ?? 1;
        $stockTurnover = $avgStock > 0 ? $soldQuantity / $avgStock : 0;

        $topMovingProducts = Product::select('products.*')
            ->selectRaw('SUM(quote_items.quantity) as total_sold')
            ->join('quote_items', 'products.id', '=', 'quote_items.product_id')
            ->join('quotes', 'quotes.id', '=', 'quote_items.quote_id')
            ->where('quotes.status', 'converted')
            ->where('quotes.created_at', '>=', Carbon::now()->subDays(90))
            ->groupBy('products.id')
            ->orderByDesc('total_sold')
            ->limit(5)
            ->get();

        $slowMovingProducts = Product::where('track_inventory', true)
            ->where('stock_quantity', '>', 0)
            ->whereDoesntHave('stockMovements', function($q) {
                $q->where('type', 'out')->where('created_at', '>=', Carbon::now()->subDays(90));
            })
            ->limit(5)
            ->get();

        return [
            'totalStockValue' => [
                'value' => $totalStockValue,
                'formatted' => number_format($totalStockValue, 2, ',', ' ') . ' MAD',
            ],
            'stockTurnover' => round($stockTurnover, 2),
            'topMovingProducts' => $topMovingProducts,
            'slowMovingProducts' => $slowMovingProducts,
            'lowStockCount' => Product::where('track_inventory', true)
                ->whereColumn('stock_quantity', '<=', 'low_stock_threshold')
                ->count(),
        ];
    }

    private function getFinancialMetrics(Carbon $startDate): array { /* inchangé */
        $totalRevenue = Invoice::where('status', 'paid')->where('date', '>=', $startDate)->sum('total_ttc');
        $totalCost = DB::table('invoice_lines')
            ->join('invoices', 'invoices.id', '=', 'invoice_lines.invoice_id')
            ->join('products', 'products.id', '=', 'invoice_lines.product_id')
            ->where('invoices.status', 'paid')
            ->where('invoices.date', '>=', $startDate)
            ->selectRaw('SUM(invoice_lines.quantity * products.cost_price) as total_cost')
            ->value('total_cost') ?? 0;

        $grossMargin = $totalRevenue > 0 ? (($totalRevenue - $totalCost) / $totalRevenue) * 100 : 0;

        $overdueInvoices = Invoice::where('due_date', '<', Carbon::now())
            ->whereIn('status', ['sent', 'issued', 'partially_paid'])
            ->count();

        $overdueAmount = Invoice::where('due_date', '<', Carbon::now())
            ->whereIn('status', ['sent', 'issued', 'partially_paid'])
            ->sum('total_ttc');

        $monthlyRevenue = Invoice::select(
                DB::raw('DATE_FORMAT(date, "%Y-%m") as month'),
                DB::raw('SUM(total_ttc) as revenue')
            )
            ->where('status', 'paid')
            ->where('date', '>=', Carbon::now()->subYear())
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        return [
            'grossMargin' => round($grossMargin, 1),
            'totalCost' => [
                'value' => $totalCost,
                'formatted' => number_format($totalCost, 2, ',', ' ') . ' MAD',
            ],
            'overdueInvoices' => [
                'count' => $overdueInvoices,
                'amount' => $overdueAmount,
                'formatted' => number_format($overdueAmount, 2, ',', ' ') . ' MAD',
            ],
            'monthlyRevenue' => $monthlyRevenue->map(function($item) {
                $date = Carbon::createFromFormat('Y-m', $item->month);
                return [
                    'month' => $item->month,
                    'label' => $date->format('M Y'),
                    'revenue' => (float) $item->revenue,
                ];
            }),
        ];
    }

    private function getPerformanceMetrics(Carbon $startDate): array { /* inchangé */
        $avgProcessingTime = Order::where('created_at', '>=', $startDate)
            ->whereNotNull('confirmed_at')
            ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, confirmed_at)) as avg_hours')
            ->value('avg_hours') ?? 0;

        $totalOrders = Order::where('created_at', '>=', $startDate)->count();
        $cancelledOrders = Order::where('created_at', '>=', $startDate)
            ->where('status', 'cancelled')->count();
        $cancellationRate = $totalOrders > 0 ? ($cancelledOrders / $totalOrders) * 100 : 0;

        $mostViewedProducts = DB::table('quote_items')
            ->join('quotes', 'quotes.id', '=', 'quote_items.quote_id')
            ->join('products', 'products.id', '=', 'quote_items.product_id')
            ->select('products.name', 'products.sku', DB::raw('COUNT(*) as views'))
            ->where('quotes.created_at', '>=', $startDate)
            ->groupBy('products.id', 'products.name', 'products.sku')
            ->orderByDesc('views')
            ->limit(5)
            ->get();

        $orderStatusEvolution = Order::select('status', DB::raw('COUNT(*) as count'))
            ->where('created_at', '>=', $startDate)
            ->groupBy('status')
            ->get();

        return [
            'avgProcessingTime' => round($avgProcessingTime, 1),
            'cancellationRate' => round($cancellationRate, 1),
            'mostViewedProducts' => $mostViewedProducts,
            'orderStatusEvolution' => $orderStatusEvolution,
        ];
    }

    private function getTrendsData(Carbon $startDate): array { /* inchangé */
        $dailyMetrics = [];
        $current = $startDate->copy();

        while ($current <= Carbon::now()) {
            $dayRevenue = Invoice::where('status', 'paid')
                ->whereDate('date', $current)
                ->sum('total_ttc');

            $dayOrders = Order::whereDate('created_at', $current)->count();
            $dayQuotes = Quote::whereDate('created_at', $current)->count();

            $dailyMetrics[] = [
                'date' => $current->format('Y-m-d'),
                'label' => $current->format('d/m'),
                'revenue' => (float) $dayRevenue,
                'orders' => $dayOrders,
                'quotes' => $dayQuotes,
            ];

            $current->addDay();
        }

        $categoryRevenue = DB::table('quote_items')
            ->join('quotes', 'quotes.id', '=', 'quote_items.quote_id')
            ->join('products', 'products.id', '=', 'quote_items.product_id')
            ->join('categories', 'categories.id', '=', 'products.category_id')
            ->select('categories.name', DB::raw('SUM(quote_items.quantity * products.price) as revenue'))
            ->where('quotes.status', 'converted')
            ->where('quotes.created_at', '>=', $startDate)
            ->groupBy('categories.id', 'categories.name')
            ->orderByDesc('revenue')
            ->get();

        return [
            'dailyMetrics' => $dailyMetrics,
            'categoryRevenue' => $categoryRevenue->map(function($item) {
                return [
                    'name' => $item->name,
                    'revenue' => (float) $item->revenue,
                    'formatted' => number_format($item->revenue, 0, ',', ' ') . ' MAD',
                ];
            }),
        ];
    }

    private function getHeatmapData(Carbon $startDate): array { /* inchangé */
        $salesHeatmap = Order::select(
                DB::raw('DAYOFWEEK(created_at) as day_of_week'),
                DB::raw('HOUR(created_at) as hour'),
                DB::raw('COUNT(*) as orders_count'),
                DB::raw('SUM(total_ttc) as revenue')
            )
            ->where('created_at', '>=', $startDate)
            ->groupBy('day_of_week', 'hour')
            ->get();

        $brandCategoryMatrix = DB::table('products')
            ->join('brands', 'brands.id', '=', 'products.brand_id')
            ->join('categories', 'categories.id', '=', 'products.category_id')
            ->join('quote_items', 'products.id', '=', 'quote_items.product_id')
            ->join('quotes', 'quotes.id', '=', 'quote_items.quote_id')
            ->select(
                'brands.name as brand_name',
                'categories.name as category_name',
                DB::raw('SUM(quote_items.quantity * products.price) as revenue'),
                DB::raw('SUM(quote_items.quantity) as quantity')
            )
            ->where('quotes.status', 'converted')
            ->where('quotes.created_at', '>=', $startDate)
            ->groupBy('brands.id', 'categories.id', 'brands.name', 'categories.name')
            ->get();

        return [
            'salesHeatmap' => $salesHeatmap,
            'brandCategoryMatrix' => $brandCategoryMatrix,
        ];
    }

    private function getSalesChartData(Carbon $startDate): array { /* inchangé */
        $days = $startDate->diffInDays(Carbon::now());
        if ($days <= 7) { $groupBy = 'DATE(date)'; $format = 'Y-m-d'; }
        elseif ($days <= 30) { $groupBy = 'DATE(date)'; $format = 'Y-m-d'; }
        else { $groupBy = 'DATE_FORMAT(date, "%Y-%m")'; $format = 'Y-m'; }

        $salesData = Invoice::select(
                DB::raw("{$groupBy} as period"),
                DB::raw('SUM(total_ttc) as revenue'),
                DB::raw('COUNT(*) as count')
            )
            ->where('status', 'paid')
            ->where('date', '>=', $startDate)
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        return $salesData->map(function ($item) use ($format, $days) {
            $date = Carbon::createFromFormat($format, $item->period);
            return [
                'date' => $item->period,
                'label' => $days <= 30 ? $date->format('d/m') : $date->format('M Y'),
                'revenue' => (float) $item->revenue,
                'orders' => (int) $item->count,
            ];
        })->toArray();
    }

    private function getTopProducts(Carbon $startDate): array
    {
        // Version basée sur les FACTURES payées, en n'utilisant que des colonnes sûres
        // (invoice_lines.quantity, products.price, invoices.date, invoices.status)
        // -> total_revenue = SUM(quantity * products.price)
        return DB::table('invoice_lines')
            ->join('invoices', 'invoices.id', '=', 'invoice_lines.invoice_id')
            ->join('products', 'products.id', '=', 'invoice_lines.product_id')
            ->select(
                'products.id',
                'products.name',
                'products.sku',
                DB::raw('SUM(invoice_lines.quantity) as total_quantity'),
                DB::raw('SUM(invoice_lines.quantity * products.price) as total_revenue')
            )
            ->where('invoices.status', 'paid')
            ->whereBetween('invoices.date', [$startDate, Carbon::now()])
            ->groupBy('products.id', 'products.name', 'products.sku')
            ->orderByDesc('total_revenue')
            ->limit(5)
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'sku' => $item->sku,
                    'quantity' => (int) $item->total_quantity,
                    'revenue' => (float) $item->total_revenue,
                    'formatted_revenue' => number_format($item->total_revenue, 2, ',', ' ') . ' MAD',
                ];
            })
            ->toArray();
    }

    private function getStockAlerts(): array { /* inchangé */
        $lowStock = Product::where('track_inventory', true)
            ->whereColumn('stock_quantity', '<=', 'low_stock_threshold')
            ->where('stock_quantity', '>', 0)
            ->with('category:id,name')
            ->orderBy('stock_quantity')
            ->limit(10)
            ->get(['id', 'name', 'sku', 'stock_quantity', 'low_stock_threshold', 'category_id']);

        $outOfStock = Product::where('track_inventory', true)
            ->where('stock_quantity', 0)
            ->with('category:id,name')
            ->limit(10)
            ->get(['id', 'name', 'sku', 'stock_quantity', 'category_id']);

        return [
            'lowStock' => $lowStock,
            'outOfStock' => $outOfStock,
        ];
    }

    private function getRecentActivity(): array { /* inchangé */
        $activities = [];

        $recentOrders = Order::with('client:id,company_name')
            ->latest()
            ->limit(5)
            ->get(['id', 'order_number', 'client_id', 'status', 'total_ttc', 'created_at']);

        foreach ($recentOrders as $order) {
            $activities[] = [
                'type' => 'order',
                'title' => "Commande {$order->order_number}",
                'description' => "Client: {$order->client->company_name}",
                'amount' => $order->total_ttc,
                'status' => $order->status,
                'created_at' => $order->created_at,
            ];
        }

        $recentQuotes = Quote::with('client:id,company_name')
            ->latest()
            ->limit(5)
            ->get(['id', 'quote_number', 'client_id', 'status', 'total_ttc', 'created_at']);

        foreach ($recentQuotes as $quote) {
            $activities[] = [
                'type' => 'quote',
                'title' => "Devis {$quote->quote_number}",
                'description' => "Client: {$quote->client->company_name}",
                'amount' => $quote->total_ttc,
                'status' => $quote->status,
                'created_at' => $quote->created_at,
            ];
        }

        return collect($activities)
            ->sortByDesc('created_at')
            ->take(8)
            ->values()
            ->toArray();
    }

    private function getCategoryDistribution(): array { /* inchangé */
        return Category::select('categories.name')
            ->selectRaw('COUNT(products.id) as product_count')
            ->selectRaw('SUM(products.stock_quantity) as total_stock')
            ->selectRaw('SUM(products.price * products.stock_quantity) as stock_value')
            ->leftJoin('products', 'categories.id', '=', 'products.category_id')
            ->where('categories.is_active', true)
            ->whereNull('products.deleted_at')
            ->groupBy('categories.id', 'categories.name')
            ->having('product_count', '>', 0)
            ->orderByDesc('product_count')
            ->get()
            ->map(function ($item) {
                return [
                    'name' => $item->name,
                    'productCount' => (int) $item->product_count,
                    'totalStock' => (int) $item->total_stock,
                    'stockValue' => (float) $item->stock_value,
                    'formattedValue' => number_format($item->stock_value, 0, ',', ' ') . ' MAD',
                ];
            })
            ->toArray();
    }

    private function getQuoteConversionRate(Carbon $startDate): array { /* inchangé */
        $totalQuotes = Quote::where('created_at', '>=', $startDate)->count();
        $convertedQuotes = Quote::where('created_at', '>=', $startDate)
            ->whereIn('status', ['accepted', 'converted'])
            ->count();

        $conversionRate = $totalQuotes > 0 ? ($convertedQuotes / $totalQuotes) * 100 : 0;

        $statusBreakdown = Quote::select('status', DB::raw('COUNT(*) as count'))
            ->where('created_at', '>=', $startDate)
            ->groupBy('status')
            ->get()
            ->mapWithKeys(function ($item) {
                return [$item->status => (int) $item->count];
            })
            ->toArray();

        return [
            'rate' => round($conversionRate, 1),
            'total' => $totalQuotes,
            'converted' => $convertedQuotes,
            'breakdown' => $statusBreakdown,
        ];
    }

    private function getMonthlyGrowth(): array { /* inchangé */
        $currentMonth = Invoice::where('status', 'paid')
            ->whereMonth('date', Carbon::now()->month)
            ->whereYear('date', Carbon::now()->year)
            ->sum('total_ttc');

        $previousMonth = Invoice::where('status', 'paid')
            ->whereMonth('date', Carbon::now()->subMonth()->month)
            ->whereYear('date', Carbon::now()->subMonth()->year)
            ->sum('total_ttc');

        $growth = $previousMonth > 0 ? (($currentMonth - $previousMonth) / $previousMonth) * 100 : 0;

        return [
            'current' => $currentMonth,
            'previous' => $previousMonth,
            'growth' => round($growth, 1),
            'formatted_current' => number_format($currentMonth, 2, ',', ' ') . ' MAD',
            'formatted_previous' => number_format($previousMonth, 2, ',', ' ') . ' MAD',
        ];
    }
}
