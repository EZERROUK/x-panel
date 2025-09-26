<?php

namespace App\Console\Commands;

use App\Models\{Product, SystemAlert};
use Illuminate\Console\Command;

class GenerateStockAlerts extends Command
{
    protected $signature = 'alerts:stock';
    protected $description = 'Génère les alertes de stock faible';

    public function handle(): int
    {
        // Nettoyer les anciennes alertes de stock
        SystemAlert::where('type', 'stock_low')->delete();

        // Produits en stock faible
        $lowStockProducts = Product::where('track_inventory', true)
            ->whereColumn('stock_quantity', '<=', 'low_stock_threshold')
            ->where('stock_quantity', '>', 0)
            ->get();

        foreach ($lowStockProducts as $product) {
            SystemAlert::createStockAlert($product);
        }

        $this->info("Générées {$lowStockProducts->count()} alertes de stock faible");
        return 0;
    }
}