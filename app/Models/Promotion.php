<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Promotion extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name','description','type','priority','is_exclusive','is_active',
        'starts_at','ends_at','days_of_week','min_subtotal','min_quantity',
        'apply_scope','stop_further_processing',
        'created_by','updated_by',
    ];

    protected $casts = [
        'is_exclusive' => 'boolean',
        'is_active' => 'boolean',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public function actions()
    {
        return $this->hasMany(PromotionAction::class);
    }

    public function codes()
    {
        return $this->hasMany(PromotionCode::class);
    }

    public function categories()
    {
        return $this->belongsToMany(Category::class, 'promotion_categories');
    }

    public function products()
    {
        return $this->belongsToMany(Product::class, 'promotion_products');
    }
}
