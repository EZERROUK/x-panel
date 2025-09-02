<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('brand_id', 36)->nullable()->index();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('model')->nullable();
            $table->string('sku')->unique();
            $table->text('description')->nullable();

            // Champs de tolérance sur le prix
            $table->enum('min_tolerance_type', ['percentage', 'amount'])->default('percentage')->nullable();
            $table->decimal('min_tolerance_value', 10, 2)->default(0)->nullable();

            // SEO
            $table->string('meta_title')->nullable();
            $table->text('meta_description')->nullable();

            // Pricing
            $table->decimal('price', 12, 2);
            $table->decimal('compare_at_price', 12, 2)->nullable();
            $table->decimal('cost_price', 12, 2)->nullable();

            // Inventory
            $table->unsignedInteger('stock_quantity')->default(0);
            $table->boolean('track_inventory')->default(true);
            $table->unsignedInteger('low_stock_threshold')->default(5);
            $table->boolean('allow_backorder')->default(false);

            // Physical attributes
            $table->decimal('weight', 8, 2)->nullable();
            $table->decimal('length', 8, 2)->nullable();
            $table->decimal('width', 8, 2)->nullable();
            $table->decimal('height', 8, 2)->nullable();

            // Product type and visibility
            $table->enum('type', ['physical', 'digital', 'service'])->default('physical');
            $table->enum('visibility', ['public', 'hidden', 'draft'])->default('public');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_featured')->default(false);

            // Availability
            $table->timestamp('available_from')->nullable();
            $table->timestamp('available_until')->nullable();

            // Digital product fields
            $table->string('download_url')->nullable();
            $table->unsignedInteger('download_limit')->nullable();
            $table->unsignedInteger('download_expiry_days')->nullable();

            // Money/Taxes/Categories
            $table->char('currency_code', 3);
            $table->foreign('currency_code')->references('code')->on('currencies');

            $table->foreignId('tax_rate_id')->constrained('tax_rates');
            $table->foreignId('category_id')->constrained('categories');

            $table->string('image_main')->nullable();

            // >>> NEW: auteur de création (type = unsigned BIGINT, FK users.id)
            $table->foreignId('created_by')->nullable()
                  ->constrained('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            // FK brand (UUID/char36)
            $table->foreign('brand_id')
                  ->references('id')->on('brands')
                  ->onDelete('cascade');

            // Index pour perfs
            $table->index(['is_active', 'visibility']);
            $table->index(['available_from', 'available_until']);
            $table->index(['is_featured', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
