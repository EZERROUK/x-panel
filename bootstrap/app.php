<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\EnsureAppIsConfigured; // ⬅️ AJOUT
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Spatie\Permission\Middleware\{
    PermissionMiddleware,
    RoleMiddleware,
    RoleOrPermissionMiddleware
};
use App\Providers\AuthServiceProvider; // ⬅️ AJOUT: provider d’auth

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {

        /* ---------- middlewares globaux ------------------------- */
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        /* ---------- pile "web" --------------------------------- */
        // On PREPEND le middleware de configuration pour qu’il s’exécute avant le reste
        $middleware->web(
            prepend: [
                EnsureAppIsConfigured::class, // ⬅️ AJOUT : redirige vers /setup si non configurée
            ],
            append: [
                HandleAppearance::class,
                HandleInertiaRequests::class,
                AddLinkHeadersForPreloadedAssets::class,
            ]
        );

        /* ---------- alias route pour spatie/laravel-permission -- */
        $middleware->alias([
            'permission'          => PermissionMiddleware::class,
            'role'                => RoleMiddleware::class,
            'role_or_permission'  => RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })
    // ⬅️ AJOUT: enregistrement du provider d’auth (bypass SuperAdmin)
    ->withProviders([
        AuthServiceProvider::class,
    ])
    ->create();
