<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\{BelongsTo, HasMany};
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class Order extends Model
{
    use LogsActivity, SoftDeletes;

    protected $fillable = [
        'order_number',
        'client_id',
        'quote_id',
        'user_id',
        'status',
        'order_date',
        'expected_delivery_date',
        'confirmed_at',
        'shipped_at',
        'delivered_at',
        'client_snapshot',
        'subtotal_ht',
        'total_tax',
        'total_ttc',
        'currency_code',
        'notes',
        'internal_notes',
    ];

    protected $casts = [
        'order_date' => 'date',
        'expected_delivery_date' => 'date',
        'confirmed_at' => 'datetime',
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
        'client_snapshot' => 'array',
        'subtotal_ht' => 'decimal:2',
        'total_tax' => 'decimal:2',
        'total_ttc' => 'decimal:2',
        'deleted_at' => 'datetime',
    ];

    public static function statuses(): array
    {
        return ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    }

    public static function generateOrderNumber(): string
    {
        $year = now()->year;
        $last = static::whereYear('order_date', $year)
            ->orderByDesc('order_number')
            ->first();

        $seq = 1;
        if ($last && preg_match("/^CMD-{$year}-(\d{6})$/", $last->order_number, $m)) {
            $seq = (int) $m[1] + 1;
        }

        return sprintf("CMD-%d-%06d", $year, $seq);
    }

    /* Relations */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class, 'currency_code', 'code');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class)->orderBy('sort_order');
    }

    /* Méthodes métier */
    public function calculateTotals(): void
    {
        $totals = $this->items->reduce(function ($carry, $item) {
            $lineHt = ($item->quantity ?? 0) * ($item->unit_price_ht_snapshot ?? 0);
            $lineTva = $lineHt * (($item->tax_rate_snapshot ?? 0) / 100);

            $carry['ht'] += $lineHt;
            $carry['tva'] += $lineTva;

            return $carry;
        }, ['ht' => 0, 'tva' => 0]);

        $this->update([
            'subtotal_ht' => $totals['ht'],
            'total_tax'   => $totals['tva'],
            'total_ttc'   => $totals['ht'] + $totals['tva'],
        ]);
    }

    public function canBeEdited(): bool
    {
        return in_array($this->status, ['pending', 'confirmed'], true);
    }

    public function canBeCancelled(): bool
    {
        return !in_array($this->status, ['delivered', 'cancelled'], true);
    }

    public function isDelivered(): bool
    {
        return $this->status === 'delivered';
    }

    /* Activity Log */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName('order')
            ->logAll()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn(string $eventName) => "Order has been {$eventName}");
    }
}