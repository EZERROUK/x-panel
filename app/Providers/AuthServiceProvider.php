<?php

namespace App\Providers;

use Illuminate\Support\Facades\Gate;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [];

    public function boot(): void
    {
        $this->registerPolicies();

        Gate::before(function ($user, string $ability) {
            if (! $user || ! method_exists($user, 'hasRole')) {
                return null;
            }
            // ✅ Ton rôle exact
            if ($user->hasRole('SuperAdmin')) {
                return true;
            }
            // (optionnel) tolérance si un jour tu ajoutes "super-admin"
            if ($user->hasRole('super-admin')) {
                return true;
            }
            return null;
        });
    }
}
