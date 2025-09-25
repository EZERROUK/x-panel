<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // --- QUOTES ---
        if (Schema::hasTable('quotes')) {
            Schema::table('quotes', function (Blueprint $table) {
                // applied_promotions (JSON)
                if (!Schema::hasColumn('quotes', 'applied_promotions')) {
                    if (Schema::hasColumn('quotes', 'total_ttc')) {
                        $table->json('applied_promotions')->nullable()->after('total_ttc');
                    } else {
                        $table->json('applied_promotions')->nullable();
                    }
                }
                // discount_total (decimal)
                if (!Schema::hasColumn('quotes', 'discount_total')) {
                    if (Schema::hasColumn('quotes', 'applied_promotions')) {
                        $table->decimal('discount_total', 12, 2)->default(0)->after('applied_promotions');
                    } else {
                        $table->decimal('discount_total', 12, 2)->default(0);
                    }
                }
            });
        }

        // --- QUOTE ITEMS ---
        if (Schema::hasTable('quote_items')) {
            Schema::table('quote_items', function (Blueprint $table) {
                if (!Schema::hasColumn('quote_items', 'discount_amount')) {
                    if (Schema::hasColumn('quote_items', 'line_total_ttc')) {
                        $table->decimal('discount_amount', 12, 2)->default(0)->after('line_total_ttc');
                    } else {
                        $table->decimal('discount_amount', 12, 2)->default(0);
                    }
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('quote_items')) {
            Schema::table('quote_items', function (Blueprint $table) {
                if (Schema::hasColumn('quote_items', 'discount_amount')) {
                    $table->dropColumn('discount_amount');
                }
            });
        }

        if (Schema::hasTable('quotes')) {
            Schema::table('quotes', function (Blueprint $table) {
                if (Schema::hasColumn('quotes', 'discount_total')) {
                    $table->dropColumn('discount_total');
                }
                if (Schema::hasColumn('quotes', 'applied_promotions')) {
                    $table->dropColumn('applied_promotions');
                }
            });
        }
    }
};
