<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1) D’abord rôles/permissions (SuperAdmin, Admin, User + toutes les perms)
        $this->call([
            RolePermissionSeeder::class,
        ]);

        // Fonction utilitaire : récupère l'user par email ou le crée via factory
        $ensureUser = function (string $email, string $name, string $role, string $password = 'password123'): User {
            $u = User::where('email', $email)->first();

            if (! $u) {
                // utilise la factory + helper de mot de passe
                $u = User::factory()
                    ->withPassword($password)
                    ->create([
                        'name'              => $name,
                        'email'             => $email,
                        'email_verified_at' => now(),
                    ]);
            } else {
                // au cas où l'utilisateur existe déjà sans email_verified_at ou mdp
                if (is_null($u->email_verified_at)) {
                    $u->email_verified_at = now();
                }
                if (! $u->password) {
                    $u->password = Hash::make($password);
                }
                $u->save();
            }

            // assigne le rôle (idempotent)
            if (! $u->hasRole($role)) {
                $u->assignRole($role);
            }

            return $u;
        };

        // 2) Comptes de base
        $super = $ensureUser('SuperAdmin@example.com', 'SuperAdmin', 'SuperAdmin', 'password123');
        $admin = $ensureUser('admin@example.com',       'Admin',      'Admin',      'password123');
        $user  = $ensureUser('user@example.com',        'User',       'User',       'password123');

        // 3) Le reste des seeders (catégories, produits, etc.)
        $this->call([
            CategorySeeder::class,
            CurrencySeeder::class,
            TaxRateSeeder::class,
            BrandSeeder::class,
            ProductSeeder::class,
            ProviderSeeder::class,
            StockMovementReasonSeeder::class,
            ClientSeeder::class,
        ]);
    }
}
