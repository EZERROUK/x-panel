<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1) Étendre la table categories pour supporter la hiérarchie et des métadonnées
        Schema::table('categories', function (Blueprint $table) {
            $table->unsignedBigInteger('parent_id')->nullable()->after('id');
            $table->tinyInteger('level')->unsigned()->default(0)->after('parent_id');
            $table->integer('sort_order')->unsigned()->default(0)->after('level');
            $table->boolean('is_active')->default(true)->after('sort_order');
            $table->text('description')->nullable()->after('slug');
            $table->string('icon')->nullable()->after('description');
            $table->string('image_path')->nullable()->after('icon');
            $table->string('meta_title')->nullable()->after('image_path');
            $table->text('meta_description')->nullable()->after('meta_title');
            $table->string('type')->default('default')->after('meta_description');
            $table->enum('visibility', ['public', 'private'])->default('public')->after('type');


            // Contrainte de clé étrangère pour parent_id
            $table->foreign('parent_id')->references('id')->on('categories')->onDelete('cascade');

            // Index pour les performances
            $table->index(['parent_id', 'sort_order']);
            $table->index(['is_active', 'level']);
        });

        // 2) Table des attributs dynamiques par catégorie
        Schema::create('category_attributes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('slug');
            $table->enum('type', [
                'text', 'number', 'decimal', 'boolean', 'select', 'multiselect',
                'date', 'url', 'email', 'textarea', 'json'
            ])->default('text');
            $table->string('unit')->nullable();
            $table->boolean('is_required')->default(false);
            $table->boolean('is_filterable')->default(true);
            $table->boolean('is_searchable')->default(false);
            $table->boolean('show_in_listing')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->text('description')->nullable();
            $table->string('default_value')->nullable();

            // $table->string('validation_rules')->nullable();
            $table->json('validation_rules')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->unique(['category_id', 'slug']);
            $table->index(['category_id', 'sort_order']);
        });

           // Options prédéfinies pour les attributs de type select/multiselect
        Schema::create('attribute_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attribute_id')->constrained('category_attributes')->onDelete('cascade');
            $table->string('label'); // ex: "DDR4", "DDR5"
            $table->string('value'); // ex: "ddr4", "ddr5"
            $table->string('color')->nullable(); // Pour affichage coloré
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['attribute_id', 'is_active']);
        });

        // 3) Table des valeurs d'attributs par produit
        Schema::create('product_attribute_values', function (Blueprint $table) {
            $table->id();
            $table->uuid('product_id');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreignId('attribute_id')->constrained('category_attributes')->onDelete('cascade');

            // Stockage des valeurs
            $table->text('value')->nullable();
            $table->string('value_string', 500)->nullable();
            $table->decimal('value_decimal', 20, 6)->nullable();
            $table->bigInteger('value_integer')->nullable();
            $table->boolean('value_boolean')->nullable();
            $table->date('value_date')->nullable();
            $table->json('value_json')->nullable();

            $table->timestamps();

            $table->unique(['product_id', 'attribute_id']);
            $table->index(['attribute_id', 'value_string']);
            $table->index(['attribute_id', 'value_decimal']);
            $table->index(['attribute_id', 'value_integer']);
            $table->index(['attribute_id', 'value_boolean']);
            $table->index(['attribute_id', 'value_date']);
        });

        // 4) Table de liaison produits-catégories (pour catégories multiples)
        Schema::create('product_categories', function (Blueprint $table) {
            $table->id();
            $table->uuid('product_id');
            $table->foreignId('category_id')->constrained()->onDelete('cascade');
            $table->boolean('is_primary')->default(false);
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->unique(['product_id', 'category_id']);
            $table->index(['category_id', 'is_primary']);
        });

        // 5) Table des variantes de produits
        Schema::create('product_variants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('parent_product_id');
            $table->string('sku')->unique();
            $table->string('name')->nullable();
            $table->decimal('price', 12, 2)->nullable();
            $table->integer('stock_quantity')->default(0);
            $table->json('variant_attributes');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('parent_product_id')->references('id')->on('products')->onDelete('cascade');
            $table->index(['parent_product_id', 'is_active']);
        });

        // 7) Table des compatibilités produits
        // Schema::create('product_compatibilities', function (Blueprint $table) {
        //     $table->id();
        //     $table->uuid('product_id');
        //     $table->uuid('compatible_with_id');
        //     $table->enum('direction', ['bidirectional', 'unidirectional'])->default('bidirectional');
        //     $table->text('note')->nullable();
        //     $table->timestamps();
        //     $table->softDeletes();

        //     $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
        //     $table->foreign('compatible_with_id')->references('id')->on('products')->onDelete('cascade');
        //     $table->unique(['product_id', 'compatible_with_id']);
        // });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_compatibilities');
        Schema::dropIfExists('product_images');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('product_categories');
        Schema::dropIfExists('product_attribute_values');
        Schema::dropIfExists('attribute_options');
        Schema::dropIfExists('category_attributes');


        Schema::table('categories', function (Blueprint $table) {
        $table->dropForeign(['parent_id']);
        $table->dropColumn([
            'parent_id', 'level', 'sort_order', 'is_active',
            'description', 'icon', 'image_path', 'meta_title', 'meta_description',   'type',
            'visibility'
        ]);
    });
    }
};
