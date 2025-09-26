<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ShippingMethod extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name', 'code', 'description', 'base_cost', 'cost_per_kg',
        'free_shipping_threshold', 'estimated_days_min', 'estimated_days_max',
        'is_active', 'zones'
    ];

    protected $casts = [
        'base_cost' => 'decimal:2',
        'cost_per_kg' => 'decimal:2',
        'free_shipping_threshold' => 'decimal:2',
        'is_active' => 'boolean',
        'zones' => 'array',
    ];

    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class);
    }

    public function calculateCost(float $weight, float $orderTotal): float
    {
        if ($this->free_shipping_threshold && $orderTotal >= $this->free_shipping_threshold) {
            return 0;
        }

        return $this->base_cost + ($weight * $this->cost_per_kg);
    }

    public function getEstimatedDelivery(): string
    {
        if ($this->estimated_days_min === $this->estimated_days_max) {
            return "{$this->estimated_days_min} jour" . ($this->estimated_days_min > 1 ? 's' : '');
        }
        
        return "{$this->estimated_days_min}-{$this->estimated_days_max} jours";
    }
}