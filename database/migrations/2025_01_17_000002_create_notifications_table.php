<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['notifiable_type', 'notifiable_id']);
        });

        // Table pour les alertes système
        Schema::create('system_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('type'); // 'stock_low', 'quote_expired', 'invoice_overdue'
            $table->string('title');
            $table->text('message');
            $table->json('data')->nullable();
            $table->enum('severity', ['info', 'warning', 'error'])->default('info');
            $table->boolean('is_read')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['type', 'is_active']);
            $table->index(['severity', 'is_read']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_alerts');
        Schema::dropIfExists('notifications');
    }
};