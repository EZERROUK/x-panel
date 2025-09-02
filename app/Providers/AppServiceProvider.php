<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\Role as CustomRole;
use App\Models\Permission as CustomPermission;
use Inertia\Inertia;
use App\Models\AppSetting;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Bindings Spatie sur tes modèles customs
        $this->app->bind(Role::class, CustomRole::class);
        $this->app->bind(Permission::class, CustomPermission::class);
    }

    public function boot(): void
    {
        /**
         * Partage global Inertia des réglages d'application.
         * - app_name : figé depuis config (branding)
         * - company_name : raison sociale (depuis DB)
         * - logos / favicon / contacts / SEO / social_links / état onboarding
         */
        Inertia::share('settings', function () {
            $s = AppSetting::query()->first();

            // Fallbacks d’assets si non configuré
            $logoUrl = $s && $s->logo_path
                ? asset('storage/' . $s->logo_path)
                : asset('storage/settings/logo.png');

            $logoDarkUrl = $s && $s->logo_dark_path
                ? asset('storage/' . $s->logo_dark_path)
                : null;

            $faviconUrl = $s && $s->favicon_path
                ? asset('storage/' . $s->favicon_path)
                : asset('/favicon.png');

            return [
                // Identité
                'app_name'        => config('app.name', 'X-Panel'), // branding figé
                'company_name'    => $s?->company_name,             // raison sociale
                'app_slogan'      => $s?->app_slogan ?? null,

                // Assets
                'logo_path'       => $logoUrl,
                'logo_dark_path'  => $logoDarkUrl,
                'favicon_url'     => $faviconUrl,

                // Contacts
                'contact_email'   => $s?->contact_email ?? null,
                'contact_phone'   => $s?->contact_phone ?? null,
                'contact_address' => $s?->contact_address ?? null,

                // Mentions / SEO
                'cgu_url'         => $s?->cgu_url ?? null,
                'privacy_url'     => $s?->privacy_url ?? null,
                'copyright'       => $s?->copyright ?? null,
                'meta_keywords'   => $s?->meta_keywords ?? null,
                'meta_description'=> $s?->meta_description ?? null,

                // Réseaux sociaux (stockés en JSON)
                'social_links'    => $s?->social_links ?? null,

                // Onboarding / setup
                'is_configured'   => (bool) ($s?->is_configured ?? false),
                'onboarded_at'    => $s?->onboarding_completed_at?->toIso8601String() ?? null,
            ];
        });
    }
}
