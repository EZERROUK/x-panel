<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        // Permissions en snake_case (alignées routes + sidebar)
        $permissions = [
            // Utilisateurs / Sécurité
            'users_management', // tag de groupe (facultatif)
            'user_list', 'user_create', 'user_edit', 'user_delete', 'user_show', 'user_export', 'user_restore',

            // Rôles
            'role_list', 'role_create', 'role_edit', 'role_delete', 'role_show', 'role_restore',

            // Permissions
            'permission_list', 'permission_create', 'permission_edit', 'permission_delete', 'permission_show', 'permission_restore',

            // Journaux
            'audit_list', 'audit_export',
            'loginlog_list', 'loginlog_export',

            // Catégories
            'category_list', 'category_create', 'category_show', 'category_edit', 'category_delete', 'category_restore',

            // Produits
            'product_list', 'product_create', 'product_show', 'product_edit', 'product_delete', 'product_restore',

            // Clients
            'client_list', 'client_create', 'client_show', 'client_edit', 'client_delete', 'client_restore',

            // Devis (quotes)
            'quote_list', 'quote_create', 'quote_show', 'quote_edit', 'quote_delete',
            'quote_convert', 'quote_export',
            'quote_change_status', // Ajout de la permission
            'quote_convert_to_invoice', // Ajout de la permission
            'quote_duplicate', // Ajout de la permission

            // Commandes (orders)
            'order_list', 'order_show',

            // Factures (invoices)
            'invoice_list', 'invoice_create', 'invoice_show', 'invoice_edit', 'invoice_delete',
            'invoice_reopen', 'invoice_export', 'invoice_send',
            'invoice_mark_paid', 'invoice_send_reminder', 'invoice_change_status', 'invoice_duplicate', // Permissions ajoutées

            // Stock & mouvements
            'stock_list', 'stock_create', 'stock_edit', 'stock_delete', 'stock_restore',

            // >>> Ajout des permissions mouvements de stock <<<
            'stock_movement_create',
            'stock_movement_restore',
            'stock_movement_delete',
            'stock_movement_edit',
            'stock_movement_show',

            // Monnaies & taxes
            'currency_list', 'currency_create', 'currency_show', 'currency_edit', 'currency_delete', 'currency_restore',
            'taxrate_list',  'taxrate_create',  'taxrate_show',  'taxrate_edit',  'taxrate_delete',  'taxrate_restore',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        // Rôles
        $superAdmin = Role::firstOrCreate(['name' => 'SuperAdmin', 'guard_name' => 'web']);
        $admin      = Role::firstOrCreate(['name' => 'Admin',      'guard_name' => 'web']);
        $user       = Role::firstOrCreate(['name' => 'User',       'guard_name' => 'web']);

        // SuperAdmin a tout
        $superAdmin->syncPermissions(Permission::all());

        // Admin : ajout des *_show manquants pour correspondre aux routes
        $admin->syncPermissions([
            'users_management',
            'user_list','user_create','user_edit','user_delete','user_show','user_export',

            'role_list',
            'permission_list',

            // Catalogue
            'category_list','category_create','category_edit','category_delete','category_show',
            'product_list','product_create','product_edit','product_delete','product_show',

            // Clients / Devis / Commandes
            'client_list','client_create','client_edit','client_delete','client_show',
            'quote_list','quote_create','quote_edit','quote_delete','quote_convert','quote_export','quote_show',
            'quote_change_status', // Permission ajoutée ici
            'quote_convert_to_invoice', // Permission ajoutée ici
            'quote_duplicate', // Permission ajoutée ici
            'order_list','order_show',

            // Factures
            'invoice_list','invoice_create','invoice_edit','invoice_reopen','invoice_export','invoice_send','invoice_show',
            'invoice_mark_paid', 'invoice_send_reminder', 'invoice_change_status', 'invoice_duplicate', // Permissions ajoutées

            // Stock
            'stock_list','stock_create','stock_edit','stock_delete',

            // Mouvements de stock (sans restore pour rester cohérent avec Stock)
            'stock_movement_create','stock_movement_edit','stock_movement_delete','stock_movement_show',

            // Financier
            'currency_list','currency_create','currency_edit','currency_delete','currency_show',
            'taxrate_list','taxrate_create','taxrate_edit','taxrate_delete','taxrate_show',

            // Logs
            'audit_list','audit_export',
            'loginlog_list','loginlog_export',
        ]);

        // User (profil lecture mostly)
        $user->syncPermissions([
            'category_list','product_list',
            'client_list',
            'quote_list',
            'order_list','order_show',
            'invoice_list','invoice_show',
            'stock_list',
            'currency_list','taxrate_list',
        ]);
    }
}
