<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();

            // portée / type de promo
            $table->enum('type', ['order','category','product','bogo'])->default('order');
            $table->integer('priority')->default(100);
            $table->boolean('is_exclusive')->default(false);
            $table->boolean('is_active')->default(true);

            // Fenêtres de validité
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->unsignedSmallInteger('days_of_week')->nullable(); // bitmask 0bSMTWTFS (1=Dimanche)

            // Conditions globales
            $table->decimal('min_subtotal', 12, 2)->nullable();
            $table->unsignedInteger('min_quantity')->nullable();
            $table->string('apply_scope')->default('order'); // 'order'|'category'|'product'
            $table->boolean('stop_further_processing')->default(false);

            // Audit
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();

            $table->softDeletes();
            $table->timestamps();

            // Index utiles
            $table->index(['is_active', 'priority']);
            $table->index(['starts_at', 'ends_at']);
        });

        Schema::create('promotion_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promotion_id')->constrained('promotions')->cascadeOnDelete();

            // Effets
            $table->enum('action_type', ['percent','fixed','bogo_free','bogo_percent'])->default('percent');
            $table->decimal('value', 12, 4)->nullable(); // % (ex: 10) ou montant fixe
            $table->decimal('max_discount_amount', 12, 2)->nullable();

            // Paramètres BOGO (MVP stocké, logique à venir)
            $table->string('buy_sku')->nullable();
            $table->unsignedInteger('buy_qty')->nullable();
            $table->string('get_sku')->nullable();
            $table->unsignedInteger('get_qty')->nullable();
            $table->decimal('bogo_discount_value', 12, 4)->nullable(); // % pour bogo_percent

            $table->timestamps();
        });

        Schema::create('promotion_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promotion_id')->constrained('promotions')->cascadeOnDelete();

            $table->string('code')->unique(); // stocker en UPPERCASE (traité dans le modèle)
            $table->unsignedInteger('max_redemptions')->nullable();
            $table->unsignedInteger('max_per_user')->nullable();
            $table->unsignedInteger('uses')->default(0);

            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->index(['promotion_id','is_active']);
        });

        Schema::create('promotion_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promotion_id')->constrained('promotions')->cascadeOnDelete();

            // ⚠️ suppose categories.id = BIGINT (classique).
            // Si tes catégories sont en UUID, remplace par ->uuid('category_id') + FK explicite.
            $table->foreignId('category_id')->constrained('categories')->cascadeOnDelete();

            $table->unique(['promotion_id','category_id']);
        });

        Schema::create('promotion_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promotion_id')->constrained('promotions')->cascadeOnDelete();

            // IMPORTANT : products.id est UUID -> on aligne le type
            $table->uuid('product_id');

            // FK explicite pour UUID
            $table->foreign('product_id')
                  ->references('id')->on('products')
                  ->onDelete('cascade');

            $table->unique(['promotion_id','product_id']);
        });

        Schema::create('promotion_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promotion_id')->constrained('promotions')->cascadeOnDelete();
            $table->foreignId('promotion_code_id')->nullable()->constrained('promotion_codes')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();

            // Liaison fonctionnelle (quote aujourd'hui; order demain)
            $table->unsignedBigInteger('quote_id')->nullable();

            $table->timestamp('used_at');
            $table->decimal('amount_discounted', 12, 2)->default(0);

            $table->timestamps();

            $table->index(['promotion_id','used_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_redemptions');
        Schema::dropIfExists('promotion_products');
        Schema::dropIfExists('promotion_categories');
        Schema::dropIfExists('promotion_codes');
        Schema::dropIfExists('promotion_actions');
        Schema::dropIfExists('promotions');
    }
};
