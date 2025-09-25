<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PromotionCode extends Model
{
    use HasFactory;

    protected $fillable = [
        'promotion_id','code','max_redemptions','max_per_user','uses',
        'starts_at','ends_at','is_active',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    protected static function booted()
    {
        static::saving(function ($model) {
            if ($model->code) {
                $model->code = mb_strtoupper(trim($model->code));
            }
        });
    }

    public function promotion()
    {
        return $this->belongsTo(Promotion::class);
    }
}
