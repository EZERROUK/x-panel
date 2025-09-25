<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PromotionRedemption extends Model
{
    use HasFactory;

    protected $fillable = [
        'promotion_id','promotion_code_id','user_id','quote_id','used_at','amount_discounted'
    ];

    protected $casts = [
        'used_at' => 'datetime',
    ];

    public function promotion()
    {
        return $this->belongsTo(Promotion::class);
    }

    public function code()
    {
        return $this->belongsTo(PromotionCode::class, 'promotion_code_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
