<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    protected $commands = [
        Commands\GenerateStockAlerts::class,
    ];

    protected function schedule(Schedule $schedule): void
    {
        // Alertes de stock tous les jours à 8h
        $schedule->command('alerts:stock')->dailyAt('08:00');
        
        // Nettoyage des logs anciens
        $schedule->command('activitylog:clean')->weekly();
        
        // Marquer les devis expirés
        $schedule->call(function () {
            \App\Models\Quote::where('valid_until', '<', now())
                ->whereIn('status', ['sent', 'viewed'])
                ->update(['status' => 'expired']);
        })->daily();
    }

    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}