<?php

namespace App\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\{HasMany, BelongsTo, BelongsToMany};
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class Category extends Model
{
    use HasFactory, SoftDeletes;

    /** Types & Visibilités autorisés */
    public const TYPE_DEFAULT = 'default';
    public const VIS_PUBLIC  = 'public';
    public const VIS_PRIVATE = 'private';

    /** Mass assignment */
    protected $fillable = [
        'name',
        'slug',
        'description',
        'image_path',
        'meta_title',
        'meta_description',
        'parent_id',
        'icon',
        'is_active',
        'sort_order',
        'level',
        'type',
        'visibility',
        'created_by',
    ];

    /** Valeurs par défaut côté modèle (en plus de la DB) */
    protected $attributes = [
        'is_active'  => true,
        'sort_order' => 0,
        'level'      => 0,
        'type'       => self::TYPE_DEFAULT,
        'visibility' => self::VIS_PUBLIC,
    ];

    protected $casts = [
        'is_active'  => 'boolean',
        'deleted_at' => 'datetime',
        'created_by' => 'integer',
    ];

    /** Expose un "depth" calculé (différent du level stocké) */
    protected $appends = ['depth'];

    /* =======================
     | Relations
     |=======================*/
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Category::class, 'parent_id')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function attributes(): HasMany
    {
        return $this->hasMany(CategoryAttribute::class)
            ->orderBy('sort_order')
            ->orderBy('name');
    }

    public function assignedProducts(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_categories')
            ->withPivot('is_primary')
            ->withTimestamps();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /* =======================
     | Scopes
     |=======================*/
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeRoots($query)
    {
        return $query->whereNull('parent_id');
    }

    public function scopeWithActiveAttributes($query)
    {
        return $query->with(['attributes' => function ($q) {
            $q->where('is_active', true)
              ->orderBy('sort_order')
              ->with(['options' => function ($optQ) {
                  $optQ->where('is_active', true)->orderBy('sort_order');
              }]);
        }]);
    }

    /** Filtrage par visibilité / type (pratique et expressif) */
    public function scopePublic($query)
    {
        return $query->where('visibility', self::VIS_PUBLIC);
    }

    public function scopePrivate($query)
    {
        return $query->where('visibility', self::VIS_PRIVATE);
    }

    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    /* =======================
     | Accessors / Helpers
     |=======================*/
    public function getImageUrl(): ?string
    {
        return $this->image_path ? Storage::url($this->image_path) : null;
    }

    public function getFullName(): string
    {
        $names = collect([$this->name]);
        $parent = $this->parent;

        while ($parent) {
            $names->prepend($parent->name);
            $parent = $parent->parent;
        }

        return $names->implode(' > ');
    }

    /** Attribut virtuel "depth" (calculé) — n’écrase pas la colonne "level" */
    public function getDepthAttribute(): int
    {
        return $this->getDepth();
    }

    public function hasChildren(): bool
    {
        return $this->children()->exists();
    }

    /** Catégorie feuille (pas d’enfants) ? */
    public function isLeaf(): bool
    {
        return !$this->hasChildren();
    }

    public function isPublic(): bool
    {
        return $this->visibility === self::VIS_PUBLIC;
    }

    public function getDepth(): int
    {
        $depth = 0;
        $parent = $this->parent;

        while ($parent) {
            $depth++;
            $parent = $parent->parent;
        }

        return $depth;
    }

    /** Tous les descendants (récursif) */
    public function getAllChildren(): \Illuminate\Support\Collection
    {
        $children = collect();

        foreach ($this->children as $child) {
            $children->push($child);
            $children = $children->merge($child->getAllChildren());
        }

        return $children;
    }

    /* =======================
     | Mutateurs sécurisés
     |=======================*/
    public function setTypeAttribute($value): void
    {
        $value = is_string($value) ? strtolower(trim($value)) : self::TYPE_DEFAULT;
        $allowed = [self::TYPE_DEFAULT /* , 'physical', 'digital', 'service', … */];
        $this->attributes['type'] = in_array($value, $allowed, true) ? $value : self::TYPE_DEFAULT;
    }

    public function setVisibilityAttribute($value): void
    {
        $value = is_string($value) ? strtolower(trim($value)) : self::VIS_PUBLIC;
        $allowed = [self::VIS_PUBLIC, self::VIS_PRIVATE];
        $this->attributes['visibility'] = in_array($value, $allowed, true) ? $value : self::VIS_PUBLIC;
    }

    /* =======================
     | Boot events
     |=======================*/
    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Category $category) {
            if (empty($category->slug)) {
                $category->slug = Str::slug($category->name);
            }
            // Valeurs par défaut côté modèle (si l’appelant n’a rien passé)
            $category->type       = $category->type       ?: self::TYPE_DEFAULT;
            $category->visibility = $category->visibility ?: self::VIS_PUBLIC;

            // ✅ Renseigner automatiquement l'auteur si disponible (Intelephense-friendly)
            if (is_null($category->created_by)) {
                $category->created_by = Auth::id(); // null si non authentifié
            }
        });

        static::updating(function (Category $category) {
            if ($category->isDirty('name') && empty($category->slug)) {
                $category->slug = Str::slug($category->name);
            }
        });

        // ⚙️ Calcul du level à chaque save (create + update)
        static::saving(function (Category $category) {
            if ($category->parent_id) {
                $parentLevel = Category::query()
                    ->whereKey($category->parent_id)
                    ->value('level') ?? 0;
                $category->level = (int) $parentLevel + 1;
            } else {
                $category->level = 0;
            }
        });

        // 🔁 Propager le nouveau level aux descendants si parent/level a changé
        static::saved(function (Category $category) {
            if ($category->wasChanged('parent_id') || $category->wasChanged('level')) {
                $category->propagateLevelToDescendants();
            }
        });
    }

    /**
     * Recalcule le level pour tous les descendants (BFS), silencieusement.
     */
    public function propagateLevelToDescendants(): void
    {
        $queue = [['id' => $this->id, 'level' => (int) $this->level]];

        while ($current = array_shift($queue)) {
            $children = Category::query()
                ->where('parent_id', $current['id'])
                ->select('id', 'level')
                ->get();

            foreach ($children as $child) {
                $newLevel = $current['level'] + 1;
                if ((int) $child->level !== $newLevel) {
                    $child->level = $newLevel;
                    $child->saveQuietly(); // évite une boucle d’events
                }
                $queue[] = ['id' => $child->id, 'level' => $newLevel];
            }
        }
    }
}
