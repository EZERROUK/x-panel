<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\{BelongsTo, HasMany, HasOne};
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class Quote extends Model
{
    use LogsActivity, SoftDeletes;

    protected $fillable = [
        'quote_number',
        'client_id',
        'user_id',
        'status',
        'quote_date',
        'valid_until',
        'sent_at',
        'viewed_at',
        'accepted_at',
        'rejected_at',
        'converted_at',
        'client_snapshot',
        'subtotal_ht',
        'total_tax',
        'total_ttc',
        'currency_code',
        'terms_conditions',
        'notes',
        'internal_notes',
        'is_expired',

        // ✅ promotions
        'discount_total',
        'applied_promotions',
    ];

    protected $casts = [
        'quote_date'      => 'date',
        'valid_until'     => 'date',
        'sent_at'         => 'datetime',
        'viewed_at'       => 'datetime',
        'accepted_at'     => 'datetime',
        'rejected_at'     => 'datetime',
        'converted_at'    => 'datetime',
        'client_snapshot' => 'array',
        'subtotal_ht'     => 'decimal:2',
        'total_tax'       => 'decimal:2',
        'total_ttc'       => 'decimal:2',
        'is_expired'      => 'boolean',
        'deleted_at'      => 'datetime',

        // ✅ promotions
        'discount_total'     => 'decimal:2',
        'applied_promotions' => 'array',
    ];

    /* Relations */
    public function client(): BelongsTo { return $this->belongsTo(Client::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function currency(): BelongsTo { return $this->belongsTo(Currency::class, 'currency_code', 'code'); }
    public function items(): HasMany { return $this->hasMany(QuoteItem::class)->orderBy('sort_order'); }
    public function statusHistories(): HasMany { return $this->hasMany(QuoteStatusHistory::class)->orderBy('created_at'); }
    public function order(): HasOne { return $this->hasOne(Order::class); }

    /* Scopes */
    public function scopeActive($q) { return $q->whereNull('deleted_at'); }
    public function scopeExpired($q) {
        return $q->where('valid_until', '<', now()->toDateString())
                 ->whereIn('status', ['sent', 'viewed']);
    }
    public function scopeByStatus($q, string $status) { return $q->where('status', $status); }

    /* Accessors */
    public function getIsExpiredAttribute(): bool {
        return $this->valid_until < now()->toDateString()
            && in_array($this->status, ['sent', 'viewed']);
    }

    public function getCanBeConvertedAttribute(): bool {
        return $this->status === 'accepted' && !$this->order;
    }

    public function getFormattedTotalAttribute(): string {
        return number_format($this->total_ttc, 2, ',', ' ') . ' ' . $this->currency_code;
    }

    /** Total TTC après remise (utile pour l’affichage) */
    public function getTotalTtcAfterDiscountAttribute(): float
    {
        $ttc  = (float) $this->total_ttc;
        $disc = (float) $this->discount_total;
        return max(0, round($ttc - $disc, 2));
    }

    /* Methods */
    public function calculateTotals(): void
    {
        $this->subtotal_ht = $this->items->sum('line_total_ht');
        $this->total_tax   = $this->items->sum('line_tax_amount');
        $this->total_ttc   = $this->items->sum('line_total_ttc');
        $this->save();
    }

    /**
     * Recalcule les totaux en tenant compte de discount_total.
     * Hypothèse : la remise réduit l'assiette HT (cas fiscal courant).
     */
    public function calculateTotalsWithDiscount(): void
    {
        $subtotalHT = (float) $this->items->sum('line_total_ht');
        $totalTax   = (float) $this->items->sum('line_tax_amount');

        $discount = max(0.0, min((float)($this->discount_total ?? 0), $subtotalHT));
        $taxRateWeighted = $subtotalHT > 0 ? ($totalTax / $subtotalHT) : 0.0;

        $newSubtotalHT = round($subtotalHT - $discount, 2);
        $newTax        = round($newSubtotalHT * $taxRateWeighted, 2);
        $newTotalTTC   = round($newSubtotalHT + $newTax, 2);

        $this->subtotal_ht = $newSubtotalHT;
        $this->total_tax   = $newTax;
        $this->total_ttc   = $newTotalTTC;

        $this->save();
    }

    public function changeStatus(string $newStatus, ?User $user = null, ?string $comment = null): bool
    {
        $old = $this->status;
        if (!$this->canTransitionTo($newStatus)) return false;

        $this->status = $newStatus;
        match ($newStatus) {
            'sent'     => $this->sent_at = now(),
            'viewed'   => $this->viewed_at = now(),
            'accepted' => $this->accepted_at = now(),
            'rejected' => $this->rejected_at = now(),
            'converted'=> $this->converted_at = now(),
            default    => null,
        };
        $this->save();

        $this->statusHistories()->create([
            'user_id'     => $user?->id,
            'from_status' => $old,
            'to_status'   => $newStatus,
            'comment'     => $comment,
        ]);

        return true;
    }

    public function canTransitionTo(string $status): bool
    {
        $transitions = [
            'draft'     => ['sent', 'rejected'],
            'sent'      => ['viewed', 'accepted', 'rejected', 'expired'],
            'viewed'    => ['accepted', 'rejected', 'expired'],
            'accepted'  => ['converted'],
            'rejected'  => [],
            'expired'   => ['sent'],
            'converted' => [],
        ];
        return in_array($status, $transitions[$this->status] ?? []);
    }

    public function convertToOrder(?User $user = null): ?Order
    {
        if (!$this->can_be_converted) return null;

        $order = Order::create([
            'order_number'  => $this->generateOrderNumber(),
            'client_id'     => $this->client_id,
            'quote_id'      => $this->id,
            'user_id'       => $user?->id ?? $this->user_id,
            'order_date'    => now()->toDateString(),
            'client_snapshot'=> $this->client_snapshot,
            'subtotal_ht'   => $this->subtotal_ht,
            'total_tax'     => $this->total_tax,
            'total_ttc'     => $this->total_ttc,
            'currency_code' => $this->currency_code,
            'notes'         => $this->notes,
            'internal_notes'=> $this->internal_notes,
        ]);

        foreach ($this->items as $it) {
            $order->items()->create([
                'product_id'                   => $it->product_id,
                'product_name_snapshot'        => $it->product_name_snapshot,
                'product_description_snapshot' => $it->product_description_snapshot,
                'product_sku_snapshot'         => $it->product_sku_snapshot,
                'unit_price_ht_snapshot'       => $it->unit_price_ht_snapshot,
                'tax_rate_snapshot'            => $it->tax_rate_snapshot,
                'quantity'                     => $it->quantity,
                'line_total_ht'                => $it->line_total_ht,
                'line_tax_amount'              => $it->line_tax_amount,
                'line_total_ttc'               => $it->line_total_ttc,
                'sort_order'                   => $it->sort_order,
            ]);
        }

        $this->changeStatus('converted', $user, 'Devis converti en commande #' . $order->order_number);
        return $order;
    }

    public function markAsExpired(): void
    {
        if ($this->is_expired && in_array($this->status, ['sent', 'viewed'])) {
            $this->changeStatus('expired', null, 'Devis expiré automatiquement');
        }
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName('quote')
            ->logAll()
            ->logOnlyDirty()
            ->logExcept(['updated_at'])
            ->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn(string $eventName) => "Quote has been {$eventName}");
    }

    public static function generateQuoteNumber(): string
    {
        $year = now()->year;
        $last = static::whereYear('created_at', $year)->orderBy('id', 'desc')->first();
        $next = $last ? (int) substr($last->quote_number, -4) + 1 : 1;
        return sprintf('DEV-%d-%04d', $year, $next);
    }

    private function generateOrderNumber(): string
    {
        $year = now()->year;
        $last = Order::whereYear('created_at', $year)->orderBy('id', 'desc')->first();
        $next = $last ? (int) substr($last->order_number, -4) + 1 : 1;
        return sprintf('CMD-%d-%04d', $year, $next);
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Quote $quote) {
            if (empty($quote->quote_number)) $quote->quote_number = static::generateQuoteNumber();
            if (empty($quote->quote_date))   $quote->quote_date   = now()->toDateString();
            if (empty($quote->valid_until))  $quote->valid_until  = now()->addDays(30)->toDateString();

            if ($quote->client && empty($quote->client_snapshot)) {
                $quote->client_snapshot = $quote->client->toSnapshot();
            }
        });
    }
}
