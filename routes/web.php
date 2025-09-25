<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use App\Http\Controllers\{
    UserController,
    RoleController,
    PermissionController,
    CategoryController,
    ProductController,
    AuditLogExportController,
    LoginLogController,
    LoginLogExportController,
    TaxRateController,
    CurrencyController,
    AppSettingController,
    AuditLogController,
    DashboardController,
    StockMovementController,
    ProviderController,
    QuoteController,
    ClientController,
    OrderController,
    StockMovementReasonController,
    InvoiceController,
    CategoryAttributesController,
    SetupController,
    PromotionController,
    QuotePromotionController,
};
use Spatie\Activitylog\Models\Activity;
use App\Models\AppSetting;

/*
|--------------------------------------------------------------------------
| Accueil public
|--------------------------------------------------------------------------
*/
Route::get('/', function () {
    $settings = AppSetting::first();

    if (!$settings || !$settings->is_configured) {
        return Redirect::route('setup.show');
    }

    return Redirect::route('login');
})->name('home');

/*
|--------------------------------------------------------------------------
| Wizard de configuration initiale (PUBLIC)
|--------------------------------------------------------------------------
*/
Route::middleware('web')->group(function () {
    Route::get('/setup', [SetupController::class, 'show'])->name('setup.show');
    Route::post('/setup', [SetupController::class, 'store'])->name('setup.store');
});

Route::get('/setup/conditions', fn () => Inertia::render('Setup/ConditionsUtilisation'))
    ->name('setup.terms');

/*
|--------------------------------------------------------------------------
| Zone protégée (auth + verified)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'verified'])->group(function () {

    /* Dashboard */
    Route::middleware(['auth', 'verified'])
        ->get('/dashboard', [DashboardController::class, 'index'])
        ->name('dashboard');

    /* Catalogue – Catégories */
    Route::prefix('categories')->name('categories.')->group(function () {
        Route::get('/',                [CategoryController::class, 'index'  ])->middleware('permission:category_list'  )->name('index');
        Route::get('/create',          [CategoryController::class, 'create' ])->middleware('permission:category_create')->name('create');
        Route::post('/',               [CategoryController::class, 'store'  ])->middleware('permission:category_create')->name('store');
        Route::get('/{category}',      [CategoryController::class, 'show'   ])->middleware('permission:category_show'  )->name('show');
        Route::get('/{category}/edit', [CategoryController::class, 'edit'   ])->middleware('permission:category_edit'  )->name('edit');
        Route::patch('/{category}',    [CategoryController::class, 'update' ])->middleware('permission:category_edit'  )->name('update');
        Route::delete('/{category}',   [CategoryController::class, 'destroy'])->middleware('permission:category_delete')->name('destroy');
        Route::post('/{id}/restore',   [CategoryController::class, 'restore'])->middleware('permission:category_restore')->name('restore');
        Route::delete('/{id}/force-delete', [CategoryController::class, 'forceDelete'])->middleware('permission:category_delete')->name('force-delete');

        Route::get('/{category}/attributes/edit',  [CategoryAttributesController::class, 'edit'])
            ->middleware('permission:category_edit')
            ->name('attributes.edit');

        Route::post('/{category}/attributes/sync', [CategoryAttributesController::class, 'sync'])
            ->middleware('permission:category_edit')
            ->name('attributes.sync');

        Route::post('/{category}/attributes-sync', [CategoryController::class, 'syncAttributes'])
            ->middleware('permission:category_edit')
            ->name('attributes-sync');
    });

    /* Clients */
    Route::prefix('clients')->name('clients.')->group(function () {
        Route::get('/',                [ClientController::class, 'index'  ])->middleware('permission:client_list'  )->name('index');
        Route::get('/create',          [ClientController::class, 'create' ])->middleware('permission:client_create')->name('create');
        Route::post('/',               [ClientController::class, 'store'  ])->middleware('permission:client_create')->name('store');
        Route::get('/{client}',        [ClientController::class, 'show'   ])->middleware('permission:client_show'   )->name('show');
        Route::get('/{client}/edit',   [ClientController::class, 'edit'   ])->middleware('permission:client_edit'   )->name('edit');
        Route::patch('/{client}',      [ClientController::class, 'update' ])->middleware('permission:client_edit'   )->name('update');
        Route::delete('/{client}',     [ClientController::class, 'destroy'])->middleware('permission:client_delete' )->name('destroy');
        Route::post('/{id}/restore',   [ClientController::class, 'restore'])->middleware('permission:client_restore')->name('restore');
    });

    /* Devis */
    Route::prefix('quotes')->name('quotes.')->group(function () {
        Route::get('/',                [QuoteController::class, 'index']        )->middleware('permission:quote_list'  )->name('index');
        Route::get('/create',          [QuoteController::class, 'create']       )->middleware('permission:quote_create')->name('create');
        Route::post('/',               [QuoteController::class, 'store']        )->middleware('permission:quote_create')->name('store');
        Route::get('/{quote}',         [QuoteController::class, 'show']         )->middleware('permission:quote_show'  )->name('show');
        Route::get('/{quote}/edit',    [QuoteController::class, 'edit']         )->middleware('permission:quote_edit'  )->name('edit');
        Route::patch('/{quote}',       [QuoteController::class, 'update']       )->middleware('permission:quote_edit'  )->name('update');
        Route::delete('/{quote}',      [QuoteController::class, 'destroy']      )->middleware('permission:quote_delete')->name('destroy');

        Route::post('/{quote}/change-status',      [QuoteController::class, 'changeStatus'   ])->middleware('permission:quote_edit'  )->name('change-status');
        Route::post('/{quote}/convert-to-order',   [QuoteController::class, 'convertToOrder' ])->middleware('permission:quote_convert')->name('convert-to-order');
        Route::post('/{quote}/convert-to-invoice', [QuoteController::class, 'convertToInvoice'])->middleware('permission:quote_convert')->name('convert-to-invoice');
        Route::post('/{quote}/duplicate',          [QuoteController::class, 'duplicate']      )->middleware('permission:quote_create')->name('duplicate');
        Route::get('/{quote}/export',              [QuoteController::class, 'export']         )->middleware('permission:quote_export' )->name('export');

        /* Promotions pour devis existants (⇒ Box sur page Show/Edit) */
        Route::post('/{quote}/promotions/preview', [QuotePromotionController::class, 'preview'])
            ->middleware('permission:quote_edit')
            ->name('promotions.preview');

        Route::post('/{quote}/promotions/apply',   [QuotePromotionController::class, 'apply'])
            ->middleware('permission:quote_edit')
            ->name('promotions.apply');

        /* Promotions “transient” (page Création de devis) */
        Route::post('/promotions/preview', [QuotePromotionController::class, 'previewTransient'])
            ->name('promotions.preview.transient');

        Route::post('/promotions/apply',   [QuotePromotionController::class, 'applyTransient'])
            ->name('promotions.apply.transient');
    });

    /* Commandes */
    Route::prefix('orders')->name('orders.')->group(function () {
        Route::get('/',        [OrderController::class, 'index'])->middleware('permission:order_list')->name('index');
        Route::get('/{order}', [OrderController::class, 'show' ])->middleware('permission:order_show')->name('show');
    });

    /* Catalogue – Produits */
    Route::prefix('products')->name('products.')->group(function () {
        Route::get('/compatible-list', [ProductController::class, 'compatibleList'])
            ->middleware('permission:product_create|product_edit|product_list')
            ->name('compatible-list');

        Route::get('/',                [ProductController::class, 'index'  ])->middleware('permission:product_list'  )->name('index');
        Route::get('/create',          [ProductController::class, 'create' ])->middleware('permission:product_create')->name('create');
        Route::post('/',               [ProductController::class, 'store'  ])->middleware('permission:product_create')->name('store');
        Route::get('/{product}',       [ProductController::class, 'show'   ])->middleware('permission:product_show'  )->name('show');
        Route::get('/{product}/edit',  [ProductController::class, 'edit'   ])->middleware('permission:product_edit'  )->name('edit');
        Route::patch('/{product}',     [ProductController::class, 'update' ])->middleware('permission:product_edit'  )->name('update');
        Route::delete('/{product}',    [ProductController::class, 'destroy'])->middleware('permission:product_delete')->name('destroy');

        Route::post('/{id}/restore',        [ProductController::class, 'restore'    ])->middleware('permission:product_restore')->name('restore');
        Route::delete('/{id}/force-delete', [ProductController::class, 'forceDelete'])->middleware('permission:product_delete'  )->name('force-delete');
    });

    /* Gestion de Stock */
    Route::prefix('stock-movements')->name('stock-movements.')->group(function () {
        Route::get('/',                [StockMovementController::class, 'index'  ])->middleware('permission:stock_movement_list'  )->name('index');
        Route::get('/create',          [StockMovementController::class, 'create' ])->middleware('permission:stock_movement_create')->name('create');
        Route::post('/',               [StockMovementController::class, 'store'  ])->middleware('permission:stock_movement_create')->name('store');
        Route::get('/report',          [StockMovementController::class, 'report' ])->middleware('permission:stock_movement_list'  )->name('report');
        Route::get('/export',          [StockMovementController::class, 'export' ])->middleware('permission:stock_movement_list'  )->name('export');

        Route::get('/{stockMovement}',      [StockMovementController::class, 'show'   ])->middleware('permission:stock_movement_list'  )->name('show');
        Route::get('/{stockMovement}/edit', [StockMovementController::class, 'edit'   ])->middleware('permission:stock_movement_edit'  )->name('edit');
        Route::patch('/{stockMovement}',    [StockMovementController::class, 'update' ])->middleware('permission:stock_movement_edit'  )->name('update');
        Route::delete('/{stockMovement}',   [StockMovementController::class, 'destroy'])->middleware('permission:stock_movement_delete')->name('destroy');

        Route::post('/{id}/restore',        [StockMovementController::class, 'restore'    ])->middleware('permission:stock_movement_edit'  )->name('restore');
        Route::delete('/{id}/force-delete', [StockMovementController::class, 'forceDelete'])->middleware('permission:stock_movement_delete')->name('force-delete');
    });

    /* Fournisseurs */
    Route::prefix('providers')->name('providers.')->group(function () {
        Route::get('/',                [ProviderController::class, 'index'  ])->middleware('permission:stock_list'  )->name('index');
        Route::get('/create',          [ProviderController::class, 'create' ])->middleware('permission:stock_create')->name('create');
        Route::post('/',               [ProviderController::class, 'store'  ])->middleware('permission:stock_create')->name('store');
        Route::get('/{provider}',      [ProviderController::class, 'show'   ])->middleware('permission:stock_list'  )->name('show');
        Route::get('/{provider}/edit}', [ProviderController::class, 'edit' ])->middleware('permission:stock_edit'  )->name('edit'); // NOTE: verify closing brace if typo in route
        Route::patch('/{provider}',    [ProviderController::class, 'update' ])->middleware('permission:stock_edit'  )->name('update');
        Route::delete('/{provider}',   [ProviderController::class, 'destroy'])->middleware('permission:stock_delete')->name('destroy');
        Route::post('/{id}/restore',   [ProviderController::class, 'restore'])->middleware('permission:stock_edit'  )->name('restore');
    });

    /* Motifs de mouvements de stock */
    Route::prefix('stock-movement-reasons')->name('stock-movement-reasons.')->group(function () {
        Route::get('/',                [StockMovementReasonController::class, 'index'  ])->middleware('permission:stock_list'  )->name('index');
        Route::get('/create',          [StockMovementReasonController::class, 'create'])->middleware('permission:stock_create')->name('create');
        Route::post('/',               [StockMovementReasonController::class, 'store' ])->middleware('permission:stock_create')->name('store');
        Route::get('/{stockMovementReason}',      [StockMovementReasonController::class, 'show'   ])->middleware('permission:stock_list'  )->name('show');
        Route::get('/{stockMovementReason}/edit', [StockMovementReasonController::class, 'edit'   ])->middleware('permission:stock_edit'  )->name('edit');
        Route::patch('/{stockMovementReason}',    [StockMovementReasonController::class, 'update' ])->middleware('permission:stock_edit'  )->name('update');
        Route::delete('/{stockMovementReason}',   [StockMovementReasonController::class, 'destroy'])->middleware('permission:stock_delete')->name('destroy');
        Route::post('/{id}/restore',             [StockMovementReasonController::class, 'restore'])->middleware('permission:stock_edit'  )->name('restore');
    });

    /* Taxes */
    Route::prefix('tax-rates')->name('taxrates.')->group(function () {
        Route::get('/',                [TaxRateController::class, 'index'  ])->middleware('permission:taxrate_list'  )->name('index');
        Route::get('/create',          [TaxRateController::class, 'create' ])->middleware('permission:taxrate_create')->name('create');
        Route::get('/{taxRate}',       [TaxRateController::class, 'show'   ])->middleware('permission:taxrate_show'  )->name('show');
        Route::post('/',               [TaxRateController::class, 'store'  ])->middleware('permission:taxrate_create')->name('store');
        Route::get('/{taxRate}/edit',  [TaxRateController::class, 'edit'   ])->middleware('permission:taxrate_edit'  )->name('edit');
        Route::put('/{taxRate}',       [TaxRateController::class, 'update' ])->middleware('permission:taxrate_edit'  )->name('update');
        Route::delete('/{taxRate}',    [TaxRateController::class, 'destroy'])->middleware('permission:taxrate_delete')->name('destroy');
        Route::post('/{id}/restore',   [TaxRateController::class, 'restore'])->middleware('permission:taxrate_restore')->name('restore');
    });

    /* Devises */
    Route::prefix('currencies')->name('currencies.')->group(function () {
        Route::get('/',                [CurrencyController::class, 'index'  ])->middleware('permission:currency_list'  )->name('index');
        Route::get('/create',          [CurrencyController::class, 'create' ])->middleware('permission:currency_create')->name('create');
        Route::post('/',               [CurrencyController::class, 'store'  ])->middleware('permission:currency_create')->name('store');
        Route::get('/{currency}',      [CurrencyController::class, 'show'   ])->middleware('permission:currency_show'  )->name('show');
        Route::get('/{currency}/edit', [CurrencyController::class, 'edit'   ])->middleware('permission:currency_edit'  )->name('edit');
        Route::put('/{currency}',      [CurrencyController::class, 'update' ])->middleware('permission:currency_edit'  )->name('update');
        Route::delete('/{currency}',   [CurrencyController::class, 'destroy'])->middleware('permission:currency_delete')->name('destroy');
        Route::post('/{id}/restore',   [CurrencyController::class, 'restore'])->middleware('permission:currency_restore')->name('restore');
    });

    /* Utilisateurs */
    Route::prefix('users')->name('users.')->group(function () {
        Route::get('/',                [UserController::class, 'index'  ])->middleware('permission:user_list'  )->name('index');
        Route::get('/export',          [UserController::class, 'export' ])->middleware('permission:user_export')->name('export');
        Route::get('/create',          [UserController::class, 'create' ])->middleware('permission:user_create')->name('create');
        Route::post('/',               [UserController::class, 'store'  ])->middleware('permission:user_create')->name('store');
        Route::get('/{id}',            [UserController::class, 'show'   ])->middleware('permission:user_show'   )->name('show');
        Route::get('/{user}/edit',     [UserController::class, 'edit'   ])->middleware('permission:user_edit'   )->name('edit');
        Route::patch('/{user}',        [UserController::class, 'update' ])->middleware('permission:user_edit'   )->name('update');
        Route::post('/{id}/restore',   [UserController::class, 'restore'])->middleware('permission:user_restore')->name('restore');
        Route::delete('/{id}',         [UserController::class, 'destroy'])->middleware('permission:user_delete' )->name('destroy');
        Route::delete('/{id}/force-delete', [UserController::class, 'forceDelete'])->middleware('permission:user_delete')->name('force-delete');
    });

    /* Rôles */
    Route::prefix('roles')->name('roles.')->group(function () {
        Route::get('/',                [RoleController::class, 'index'  ])->middleware('permission:role_list'  )->name('index');
        Route::get('/create',          [RoleController::class, 'create' ])->middleware('permission:role_create')->name('create');
        Route::post('/',               [RoleController::class, 'store'  ])->middleware('permission:role_create')->name('store');
        Route::get('/{id}',            [RoleController::class, 'show'   ])->middleware('permission:role_show'   )->name('show');
        Route::get('/{role}/edit',     [RoleController::class, 'edit'   ])->middleware('permission:role_edit'   )->name('edit');
        Route::patch('/{role}',        [RoleController::class, 'update' ])->middleware('permission:role_edit'   )->name('update');
        Route::delete('/{id}',         [RoleController::class, 'destroy'])->middleware('permission:role_delete' )->name('destroy');
        Route::post('/{id}/restore',   [RoleController::class, 'restore'])->middleware('permission:role_restore')->name('restore');
    });

    /* Permissions */
    Route::prefix('permissions')->name('permissions.')->group(function () {
        Route::get('/',                   [PermissionController::class, 'index' ])->middleware('permission:permission_list'  )->name('index');
        Route::get('/create',             [PermissionController::class, 'create'])->middleware('permission:permission_create')->name('create');
        Route::post('/',                  [PermissionController::class, 'store' ])->middleware('permission:permission_create')->name('store');
        Route::get('/{permission}',       [PermissionController::class, 'show'  ])->middleware('permission:permission_show'   )->name('show');
        Route::get('/{permission}/edit',  [PermissionController::class, 'edit'  ])->middleware('permission:permission_edit'   )->name('edit');
        Route::patch('/{permission}',     [PermissionController::class, 'update'])->middleware('permission:permission_edit'   )->name('update');
        Route::delete('/{id}',            [PermissionController::class, 'destroy'])->middleware('permission:permission_delete')->name('destroy');
        Route::post('/{id}/restore',      [PermissionController::class, 'restore'])->middleware('permission:permission_restore')->name('restore');
    });

    /* Factures */
    Route::prefix('invoices')->name('invoices.')->group(function () {
        Route::get('/',                    [InvoiceController::class, 'index'])->middleware('permission:invoice_list'   )->name('index');
        Route::get('/{invoice}',           [InvoiceController::class, 'show' ])->middleware('permission:invoice_show'   )->name('show');
        Route::get('/{invoice}/export-pdf',[InvoiceController::class, 'exportPdf'])->middleware('permission:invoice_export')->name('export-pdf');
        Route::get('/{invoice}/edit',      [InvoiceController::class, 'edit' ])->middleware('permission:invoice_edit'   )->name('edit');
        Route::patch('/{invoice}',         [InvoiceController::class, 'update'])->middleware('permission:invoice_edit'   )->name('update');
        Route::post('/{invoice}/duplicate',[InvoiceController::class, 'duplicate'])->middleware('permission:invoice_create')->name('duplicate');
        Route::post('/{invoice}/send',     [InvoiceController::class, 'send' ])->middleware('permission:invoice_send'   )->name('send');
        Route::post('/{invoice}/mark-paid',[InvoiceController::class, 'markAsPaid'])->middleware('permission:invoice_edit')->name('mark-paid');
        Route::post('/{invoice}/send-reminder', [InvoiceController::class, 'sendReminder'])->middleware('permission:invoice_send')->name('send-reminder');
        Route::post('/{invoice}/change-status', [InvoiceController::class, 'changeStatus'])->middleware('permission:invoice_edit')->name('change-status');
        Route::post('/{invoice}/reopen',        [InvoiceController::class, 'reopen'])->middleware('permission:invoice_reopen')->name('reopen');
    });

    /* Logs d'audit & de connexion */
    Route::get('/audit-logs', function () {
        $logs = Activity::with('causer')->latest()->get();

        return Inertia::render('audit-logs/Index', [
            'logs' => [
                'data'         => $logs,
                'current_page' => 1,
                'per_page'     => 10,
                'total'        => $logs->count(),
            ],
        ]);
    })->middleware('permission:audit_list')->name('audit-logs.index');

    Route::get('/audit-logs/export', [AuditLogExportController::class, 'export'])
        ->middleware('permission:audit_export')
        ->name('audit-logs.export');

    Route::get('/login-logs', [LoginLogController::class, 'index'])
        ->middleware('permission:loginlog_list')
        ->name('login-logs.index');

    Route::get('/login-logs/export', [LoginLogExportController::class, 'export'])
        ->middleware('permission:loginlog_export')
        ->name('login-logs.export');

    /* API FRONT interne (accessible en session) */
    Route::prefix('api')->group(function () {
        Route::get('/categories/{category}/attributes', [CategoryController::class, 'apiAttributes'])
            ->middleware('permission:category_show')
            ->name('api.categories.attributes');

        Route::get('/products/search', [ProductController::class, 'apiSearch'])
            ->middleware('permission:product_list')
            ->name('api.products.search');

        Route::get('/products/compatible-list', [ProductController::class, 'compatibleList'])
            ->middleware('permission:product_create|product_edit|product_list')
            ->name('api.products.compatible-list');
    });

    /* ✅ Promotions (back-office CRUD) */
    Route::prefix('promotions')->name('promotions.')->group(function () {
        Route::get('/',                 [PromotionController::class, 'index'  ])->middleware('permission:promotion_list'  )->name('index');
        Route::get('/create',           [PromotionController::class, 'create' ])->middleware('permission:promotion_create')->name('create');
        Route::post('/',                [PromotionController::class, 'store'  ])->middleware('permission:promotion_create')->name('store');
        Route::get('/{promotion}/edit', [PromotionController::class, 'edit'   ])->middleware('permission:promotion_edit'  )->name('edit');

        Route::match(['put','patch'], '/{promotion}', [PromotionController::class, 'update'])
            ->middleware('permission:promotion_edit')
            ->name('update');

        Route::delete('/{promotion}',   [PromotionController::class, 'destroy'])->middleware('permission:promotion_delete')->name('destroy');
        Route::delete('/',              [PromotionController::class, 'massDestroy'])->middleware('permission:promotion_delete')->name('mass-destroy');
    });

});

require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
