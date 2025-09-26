<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class SystemAlert extends Model
{
    protected $fillable = [
        'type', 'title', 'message', 'data', 'severity', 
        'is_read', 'is_active', 'expires_at'
    ];

    protected $casts = [
        'data' => 'array',
        'is_read' => 'boolean',
        'is_active' => 'boolean',
        'expires_at' => 'datetime',
    ];

    // Scopes
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)
                    ->where(function ($q) {
                        $q->whereNull('expires_at')
                          ->orWhere('expires_at', '>', now());
                    });
    }

    public function scopeUnread(Builder $query): Builder
    {
        return $query->where('is_read', false);
    }

    public function scopeBySeverity(Builder $query, string $severity): Builder
    {
        return $query->where('severity', $severity);
    }

    // Méthodes
    public function markAsRead(): void
    {
        $this->update(['is_read' => true]);
    }

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    // Factory methods
    public static function createStockAlert(Product $product): self
    {
        return static::create([
            'type' => 'stock_low',
            'title' => 'Stock faible',
            'message' => "Le produit \"{$product->name}\" a un stock faible ({$product->stock_quantity} unités)",
            'data' => ['product_id' => $product->id],
            'severity' => 'warning',
        ]);
    }

    public static function createQuoteExpiredAlert(Quote $quote): self
    {
        return static::create([
            'type' => 'quote_expired',
            'title' => 'Devis expiré',
            'message' => "Le devis {$quote->quote_number} a expiré",
            'data' => ['quote_id' => $quote->id],
            'severity' => 'info',
        ]);
    }

    public static function createInvoiceOverdueAlert(Invoice $invoice): self
    {
        return static::create([
            'type' => 'invoice_overdue',
            'title' => 'Facture en retard',
            'message' => "La facture {$invoice->number} est en retard de paiement",
            'data' => ['invoice_id' => $invoice->id],
            'severity' => 'error',
        ]);
    }
}