<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1) Ajouter le support des variantes (et SEO) à la table products sans doublons
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'has_variants')) {
                $table->boolean('has_variants')->default(false)->after('is_active');
            }
            if (!Schema::hasColumn('products', 'meta_title')) {
                $table->string('meta_title')->nullable()->after('description');
            }
            if (!Schema::hasColumn('products', 'meta_description')) {
                $table->text('meta_description')->nullable()->after('meta_title');
            }
            if (!Schema::hasColumn('products', 'meta_keywords')) {
                $table->text('meta_keywords')->nullable()->after('meta_description');
            }
        });

        // 2) Ajustements conditionnels sur les tables déjà créées par la migration du 12/05

        // a) category_attributes : ajouter softDeletes si absent
        if (Schema::hasTable('category_attributes') && !Schema::hasColumn('category_attributes', 'deleted_at')) {
            Schema::table('category_attributes', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        // b) product_variants : s'assurer que softDeletes existe
        if (Schema::hasTable('product_variants') && !Schema::hasColumn('product_variants', 'deleted_at')) {
            Schema::table('product_variants', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        // On ne recrée aucune table ici (pas de Schema::create)
    }

    public function down(): void
    {
        // Retirer uniquement ce que nous avons potentiellement ajouté

        // Colonnes SEO & has_variants de products
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'meta_keywords')) {
                $table->dropColumn('meta_keywords');
            }
            if (Schema::hasColumn('products', 'meta_description')) {
                $table->dropColumn('meta_description');
            }
            if (Schema::hasColumn('products', 'meta_title')) {
                $table->dropColumn('meta_title');
            }
            if (Schema::hasColumn('products', 'has_variants')) {
                $table->dropColumn('has_variants');
            }
        });

        // Soft deletes ajoutés conditionnellement
        if (Schema::hasTable('category_attributes') && Schema::hasColumn('category_attributes', 'deleted_at')) {
            Schema::table('category_attributes', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }
        if (Schema::hasTable('product_variants') && Schema::hasColumn('product_variants', 'deleted_at')) {
            Schema::table('product_variants', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }
    }
};
