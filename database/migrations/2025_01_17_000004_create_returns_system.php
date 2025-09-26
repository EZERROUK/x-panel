<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Retours de produits
        Schema::create('product_returns', function (Blueprint $table) {
            $table->id();
            $table->string('return_number')->unique();
            $table->foreignId('order_id')->constrained()->onDelete('cascade');
            $table->foreignId('client_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->comment('Utilisateur qui traite le retour');
            
            $table->enum('status', ['requested', 'approved', 'rejected', 'received', 'processed', 'refunded'])
                  ->default('requested');
            $table->enum('reason', ['defective', 'wrong_item', 'not_as_described', 'changed_mind', 'damaged', 'other'])
                  ->default('other');
            
            $table->text('reason_details')->nullable();
            $table->decimal('refund_amount', 12, 2)->default(0);
            $table->enum('refund_method', ['original_payment', 'store_credit', 'bank_transfer'])->nullable();
            
            $table->timestamp('requested_at');
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            
            $table->text('internal_notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'requested_at']);
        });

        // Articles retournés
        Schema::create('product_return_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('return_id')->constrained('product_returns')->onDelete('cascade');
            $table->uuid('product_id');
            $table->decimal('quantity', 10, 2);
            $table->decimal('unit_price', 12, 2);
            $table->enum('condition', ['new', 'used', 'damaged', 'defective'])->default('used');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
        });

        // Tickets SAV
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number')->unique();
            $table->foreignId('client_id')->constrained()->onDelete('cascade');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->onDelete('set null');
            
            $table->string('subject');
            $table->text('description');
            $table->enum('priority', ['low', 'medium', 'high', 'urgent'])->default('medium');
            $table->enum('status', ['open', 'in_progress', 'waiting_client', 'resolved', 'closed'])->default('open');
            $table->enum('category', ['technical', 'billing', 'shipping', 'return', 'general'])->default('general');
            
            $table->foreignId('related_order_id')->nullable()->constrained('orders')->onDelete('set null');
            $table->foreignId('related_product_id')->nullable()->constrained('products')->onDelete('set null');
            
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'priority']);
        });

        // Réponses aux tickets
        Schema::create('support_ticket_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('support_tickets')->onDelete('cascade');
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
            $table->text('message');
            $table->boolean('is_internal')->default(false);
            $table->json('attachments')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_ticket_replies');
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('product_return_items');
        Schema::dropIfExists('product_returns');
    }
};