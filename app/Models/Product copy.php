<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\{BelongsTo, HasMany, BelongsToMany};
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;
use Illuminate\Support\Facades\Storage;
use App\Models\CategoryAttribute;
use App\Models\User; // ← NEW

class Product extends Model
{
    use HasUuids, HasFactory, SoftDeletes, LogsActivity;

    protected $fillable = [
        'brand_id', 'name', 'model', 'sku', 'description', 'price', 'stock_quantity',
        'currency_code', 'tax_rate_id', 'category_id', 'image_main', 'is_active',
        'slug', 'meta_title', 'meta_description', 'meta_keywords', 'type',
        'compare_at_price', 'cost_price',
        'weight', 'length', 'width', 'height', 'track_inventory', 'low_stock_threshold',
        'allow_backorder', 'is_featured', 'visibility', 'available_from', 'available_until',
        'download_url', 'download_limit', 'download_expiry_days', 'has_variants',
        'min_tolerance_type', 'min_tolerance_value',
        'created_by', // ← NEW (pour autoriser le mass assignment depuis le controller)
    ];

    protected $casts = [
        'price'              => 'decimal:2',
        'compare_at_price'   => 'decimal:2',
        'cost_price'         => 'decimal:2',
        'weight'             => 'decimal:2',
        'length'             => 'decimal:2',
        'width'              => 'decimal:2',
        'height'             => 'decimal:2',
        'is_active'          => 'boolean',
        'track_inventory'    => 'boolean',
        'allow_backorder'    => 'boolean',
        'is_featured'        => 'boolean',
        'has_variants'       => 'boolean',
        'available_from'     => 'datetime',
        'available_until'    => 'datetime',
        'deleted_at'         => 'datetime',
        'min_tolerance_value'=> 'decimal:2',
    ];

    /* -----------------------------------------------------------------
     | Relations principales
     |-----------------------------------------------------------------*/
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class, 'currency_code', 'code');
    }

    public function taxRate(): BelongsTo
    {
        return $this->belongsTo(TaxRate::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('is_primary', 'desc');
    }

    public function priceHistories(): HasMany
    {
        return $this->hasMany(PriceHistory::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    /** EAV values (product_attribute_values) */
    public function attributeValues(): HasMany
    {
        return $this->hasMany(ProductAttributeValue::class);
    }

    /** Catégories multiples (annexes) */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'product_categories')
            ->withPivot('is_primary')
            ->withTimestamps();
    }

    /** Compatibilités */
    // public function compatibleWith(): BelongsToMany
    // {
    //     return $this->belongsToMany(Product::class, 'product_compatibilities', 'product_id', 'compatible_with_id')
    //         ->withPivot('direction', 'note')
    //         ->withTimestamps();
    // }

    // Compatibilité produit → produit (sortants, exclut soft-deleted)
    public function compatibleProducts()
    {
    return $this->belongsToMany(
    self::class,
    'product_compatibilities',
    'product_id', // clé locale dans la table pivot
    'compatible_with_id' // clé liée dans la table pivot
    )
    ->withPivot(['direction','note','created_at','updated_at','deleted_at'])
    ->wherePivotNull('deleted_at');
    }

    public function incomingCompatibleProducts()
    {
    return $this->belongsToMany(
    self::class,
    'product_compatibilities',
    'compatible_with_id',
    'product_id'
    )
    ->withPivot(['direction','note','created_at','updated_at','deleted_at'])
    ->wherePivotNull('deleted_at');
    }

    // public function isCompatibleWith(): BelongsToMany
    // {
    //     return $this->belongsToMany(Product::class, 'product_compatibilities', 'compatible_with_id', 'product_id')
    //         ->withPivot('direction', 'note')
    //         ->withTimestamps();
    // }

    /** Créateur (FK users.id) */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by'); // ← NEW (utilisé par le controller)
    }

    /* -----------------------------------------------------------------
     | Scopes
     |-----------------------------------------------------------------*/
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeVisible($query)
    {
        return $query->where('visibility', 'public')
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('available_from')
                  ->orWhere('available_from', '<=', now());
            })
            ->where(function ($q) {
                $q->whereNull('available_until')
                  ->orWhere('available_until', '>=', now());
            });
    }

    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }

    public function scopeInStock($query)
    {
        return $query->where(function ($q) {
            $q->where('track_inventory', false)
              ->orWhere('stock_quantity', '>', 0);
        });
    }

    public function scopeLowStock($query)
    {
        return $query->where('track_inventory', true)
            ->whereColumn('stock_quantity', '<=', 'low_stock_threshold');
    }

    /* -----------------------------------------------------------------
     | EAV helpers
     |-----------------------------------------------------------------*/
    public function getCustomAttributeValue(string $attributeSlug)
    {
        $value = $this->attributeValues()
            ->whereHas('attribute', function ($q) use ($attributeSlug) {
                $q->where('slug', $attributeSlug);
            })
            ->first();

        return $value ? $value->getTypedValueAttribute() : null;
    }

    public function setCustomAttributeValue(string $attributeSlug, $value): void
    {
        $attribute = CategoryAttribute::where('slug', $attributeSlug)
            ->whereHas('category', function ($q) {
                $q->where('id', $this->category_id);
            })
            ->first();

        if (!$attribute) {
            return;
        }

        // Version texte "sûre" pour la colonne value
        if (is_array($value) || is_object($value)) {
            $raw = json_encode($value, JSON_UNESCAPED_UNICODE);
        } elseif (is_bool($value)) {
            $raw = $value ? '1' : '0';
        } elseif ($value === null) {
            $raw = null;
        } else {
            $raw = (string) $value;
        }

        $data = [
            'value'          => $raw,
            'value_string'   => null,
            'value_decimal'  => null,
            'value_integer'  => null,
            'value_boolean'  => null,
            'value_date'     => null,
            'value_json'     => null,
        ];

        // Remplir la colonne typée appropriée
        switch ($attribute->type) {
            case 'number':
                $data['value_integer'] = is_numeric($value) ? (int) $value : null;
                $data['value_string']  = is_numeric($value) ? (string) $value : null;
                break;

            case 'decimal':
                $data['value_decimal'] = is_numeric($value) ? (float) $value : null;
                $data['value_string']  = is_numeric($value) ? (string) $value : null;
                break;

            case 'boolean':
                $bool = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                $data['value_boolean'] = $bool;
                $data['value_string']  = is_null($bool) ? null : ($bool ? '1' : '0');
                break;

            case 'date':
                try {
                    $data['value_date']   = $value ? \Carbon\Carbon::parse($value)->toDateString() : null;
                    $data['value_string'] = $data['value_date'];
                } catch (\Throwable $e) {
                    $data['value_date']   = null;
                    $data['value_string'] = null;
                }
                break;

            case 'multiselect':
                $arr = is_array($value) ? $value : (array) $value;
                $data['value_json']   = json_encode($arr, JSON_UNESCAPED_UNICODE);
                $data['value_string'] = implode(',', array_map('strval', $arr));
                break;

            case 'json':
                if (is_string($value)) {
                    $decoded = json_decode($value, true);
                    $data['value_json']   = json_last_error() === JSON_ERROR_NONE
                        ? json_encode($decoded, JSON_UNESCAPED_UNICODE)
                        : $value;
                    $data['value_string'] = is_array($decoded) ? null : $value;
                } else {
                    $data['value_json'] = json_encode($value, JSON_UNESCAPED_UNICODE);
                }
                break;

            default: // text, textarea, select, email, url, etc.
                $data['value_string'] = $raw !== null ? mb_substr((string) $raw, 0, 500) : null;
                break;
        }

        $this->attributeValues()->updateOrCreate(
            ['attribute_id' => $attribute->id],
            $data
        );
    }

    /**
     * Récupère la liste des attributs actifs de la catégorie avec leurs valeurs courantes et formatées.
     * Optimisé pour éviter un N+1 sur product_attribute_values.
     */
    public function getAttributesForCategory(): \Illuminate\Support\Collection
    {
        if (!$this->category) {
            return collect();
        }

        // Précharger les valeurs existantes (key: attribute_id)
        $valuesByAttrId = $this->attributeValues->keyBy('attribute_id');

        return $this->category->attributes()
            ->active()
            ->with(['options' => function ($q) {
                $q->active()->orderBy('sort_order');
            }])
            ->orderBy('sort_order')
            ->get()
            ->map(function ($attribute) use ($valuesByAttrId) {
                $valueModel = $valuesByAttrId->get($attribute->id);

                $attribute->current_value   = $valueModel ? $valueModel->getTypedValueAttribute()     : null;
                $attribute->formatted_value = $valueModel ? $valueModel->getFormattedValueAttribute() : null;

                return $attribute;
            });
    }

    /* -----------------------------------------------------------------
     | Méthodes e-commerce
     |-----------------------------------------------------------------*/
    public function getImageUrl(): ?string
    {
        return $this->image_main ? Storage::url($this->image_main) : null;
    }

    public function getPrimaryImage(): ?ProductImage
    {
        return $this->images()->where('is_primary', true)->first();
    }

    public function getFormattedPrice(): string
    {
        return number_format($this->price, 2, ',', ' ') . ' ' . $this->currency_code;
    }

    public function hasDiscount(): bool
    {
        return $this->compare_at_price && $this->compare_at_price > $this->price;
    }

    public function getDiscountPercentage(): ?float
    {
        if (!$this->hasDiscount()) {
            return null;
        }

        return round((($this->compare_at_price - $this->price) / $this->compare_at_price) * 100, 1);
    }

    public function isInStock(): bool
    {
        return !$this->track_inventory || $this->stock_quantity > 0;
    }

    public function isLowStock(): bool
    {
        return $this->track_inventory && $this->stock_quantity <= $this->low_stock_threshold;
    }

    public function isAvailable(): bool
    {
        if (!$this->is_active || $this->visibility !== 'public') {
            return false;
        }

        if ($this->available_from && $this->available_from->isFuture()) {
            return false;
        }

        if ($this->available_until && $this->available_until->isPast()) {
            return false;
        }

        return true;
    }

    public function canBeOrdered(): bool
    {
        return $this->isAvailable() && ($this->isInStock() || $this->allow_backorder);
    }

    /* -----------------------------------------------------------------
     | Boot events
     |-----------------------------------------------------------------*/
    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Product $product) {
            if (empty($product->slug)) {
                $product->slug = \Illuminate\Support\Str::slug($product->name);
            }
        });

        static::updating(function (Product $product) {
            if ($product->isDirty('name') && empty($product->slug)) {
                $product->slug = \Illuminate\Support\Str::slug($product->name);
            }
        });
    }

    /* -----------------------------------------------------------------
     | Spatie activitylog
     |-----------------------------------------------------------------*/
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName('product')
            ->logAll()
            ->logOnlyDirty()
            ->logExcept(['updated_at'])
            ->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn(string $eventName) => "Product has been {$eventName}");
    }
}
