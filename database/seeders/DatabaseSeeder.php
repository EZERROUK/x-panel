<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1) D'abord rôles/permissions (pour que le rôle existe)
        $this->call([
            RolePermissionSeeder::class,
        ]);

        // 2) Créer le SuperAdmin AVANT les seeders qui utilisent created_by
        $admin = \App\Models\User::factory()->create([
            'name'  => 'SuperAdmin',
            'email' => 'SuperAdmin@example.com',
        ]);
        $admin->assignRole('SuperAdmin');

        // 3) Le reste des seeders (catégories, produits, etc.)
        $this->call([
            CategorySeeder::class,
            CurrencySeeder::class,
            TaxRateSeeder::class,
            BrandSeeder::class,
            ProductSeeder::class,
            ProviderSeeder::class,
            StockMovementReasonSeeder::class,
            AppSettingSeeder::class,
            ClientSeeder::class,
        ]);
    }
}
