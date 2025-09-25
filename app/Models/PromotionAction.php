<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PromotionAction extends Model
{
    use HasFactory;

    protected $fillable = [
        'promotion_id','action_type','value','max_discount_amount',
        'buy_sku','buy_qty','get_sku','get_qty','bogo_discount_value',
    ];

    public function promotion()
    {
        return $this->belongsTo(Promotion::class);
    }
}
