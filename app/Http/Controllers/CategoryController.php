<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\CategoryAttribute;
use App\Http\Requests\CategoryRequest;
use App\Http\Requests\SyncCategoryAttributesRequest;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\JsonResponse;
use Inertia\Inertia;
use Inertia\Response;

class CategoryController extends Controller
{
    /** Liste paginée */
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search'    => ['nullable', 'string', 'max:255'],
            'parent_id' => ['nullable', 'string', 'max:20'], // "root" ou un id
            'status'    => ['nullable', 'in:active,inactive,all'],
            'per_page'  => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $perPage = $filters['per_page'] ?? 15;

        $query = Category::query()
            ->with([
                'parent',
                'children',
                'creator:id,name', // ✅ auteur
            ])
            ->withCount(['products']);

        if (!empty($filters['search'])) {
            $search = trim($filters['search']);
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhere('slug', 'like', "%{$search}%")
                  ->orWhere('meta_title', 'like', "%{$search}%")
                  ->orWhere('meta_description', 'like', "%{$search}%");
            });
        }

        if (!empty($filters['parent_id'])) {
            if ($filters['parent_id'] === 'root') {
                $query->whereNull('parent_id');
            } elseif (ctype_digit((string) $filters['parent_id'])) {
                $query->where('parent_id', (int) $filters['parent_id']);
            }
        }

        if (!empty($filters['status'])) {
            if ($filters['status'] === 'active') {
                $query->where('is_active', true);
            } elseif ($filters['status'] === 'inactive') {
                $query->where('is_active', false);
            }
        }

        $categories = $query->withTrashed()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->paginate($perPage)
            ->appends($request->all());

        $categories->getCollection()->transform(function (Category $category) {
            $category->image_url = $category->getImageUrl();
            // $category->creator est déjà disponible via with('creator')
            return $category;
        });

        $parentCategories = $this->buildParentOptions();

        return Inertia::render('Categories/Index', [
            'categories'       => $categories,
            'filters'          => $request->only(['search', 'parent_id', 'status']),
            'parentCategories' => $parentCategories->map(fn ($c) => [
                'id'             => $c->id,
                'name'           => $c->name,
                'level'          => $c->level,
                'indented_name'  => $c->indented_name,
                'full_name'      => $c->full_name,
                'has_children'   => $c->has_children,
            ]),
        ]);
    }

    /** Formulaire de création */
    public function create(): Response
    {
        $availableParents = $this->buildParentOptions(true);

        return Inertia::render('Categories/Create', [
            'availableParents' => $availableParents->map(fn ($c) => [
                'id'             => $c->id,
                'name'           => $c->name,
                'level'          => $c->level,
                'indented_name'  => $c->indented_name,
                'full_name'      => $c->full_name,
                'has_children'   => $c->has_children,
            ]),
            'parent' => null,
        ]);
    }

    /** Création */
    public function store(CategoryRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        if ($request->hasFile('image')) {
            $validated['image_path'] = $request->file('image')->store('categories', 'public');
        }

        try {
            DB::transaction(function () use (&$validated) {
                $category = Category::create([
                    'name'             => $validated['name'],
                    'slug'             => $validated['slug'],
                    'parent_id'        => $validated['parent_id'] ?? null,
                    'icon'             => $validated['icon'] ?? null,
                    'description'      => $validated['description'] ?? null,
                    'is_active'        => $validated['is_active'] ?? true,
                    'sort_order'       => $validated['sort_order'] ?? 0,
                    'meta_title'       => $validated['meta_title'] ?? null,
                    'meta_description' => $validated['meta_description'] ?? null,
                    'image_path'       => $validated['image_path'] ?? null,
                    // 👇 ajoutés
                    'type'             => $validated['type'] ?? 'default',
                    'visibility'       => $validated['visibility'] ?? 'public',
                    'created_by'       => Auth::id(), // ✅ auteur
                ]);

                $attributes = $validated['attributes'] ?? [];

                foreach ($attributes as $index => $attr) {
                    /** @var \App\Models\CategoryAttribute $attribute */
                    $attribute = $category->attributes()->create([
                        'name'            => $attr['name'],
                        'slug'            => $attr['slug'] ?: Str::slug($attr['name']),
                        'type'            => $attr['type'],
                        'unit'            => $attr['unit'] ?? null,
                        'description'     => $attr['description'] ?? null,
                        'is_required'     => (bool)($attr['is_required'] ?? false),
                        'is_filterable'   => (bool)($attr['is_filterable'] ?? false),
                        'is_searchable'   => (bool)($attr['is_searchable'] ?? false),
                        'show_in_listing' => (bool)($attr['show_in_listing'] ?? false),
                        'is_active'       => (bool)($attr['is_active'] ?? true),
                        'sort_order'      => $attr['sort_order'] ?? $index,
                        'default_value'   => $attr['default_value'] ?? null,
                        'validation_rules'=> is_array($attr['validation_rules'] ?? null)
                            ? json_encode($attr['validation_rules'])
                            : ($attr['validation_rules'] ?? null),
                    ]);

                    if (in_array($attr['type'], ['select', 'multiselect'], true) && !empty($attr['options'])) {
                        foreach ($attr['options'] as $optIndex => $opt) {
                            $label     = is_array($opt) ? ($opt['label'] ?? '') : (string)$opt;
                            if ($label === '') continue;

                            $value     = is_array($opt) ? ($opt['value'] ?? Str::slug($label)) : Str::slug((string)$opt);
                            $color     = is_array($opt) ? ($opt['color'] ?? null) : null;
                            $isActive  = is_array($opt) ? (bool)($opt['is_active'] ?? true) : true;
                            $sortOrder = is_array($opt) && array_key_exists('sort_order', $opt) ? (int)$opt['sort_order'] : $optIndex;

                            $attribute->options()->create([
                                'label'      => $label,
                                'value'      => $value,
                                'color'      => $color,
                                'is_active'  => $isActive,
                                'sort_order' => $sortOrder,
                            ]);
                        }
                    }
                }
            });
        } catch (\Throwable $e) {
            Log::error('Category store failed', ['error' => $e->getMessage()]);
            return back()->with('error', 'Une erreur est survenue lors de la création.')->withInput();
        }

        return redirect()->route('categories.index')->with('success', 'Catégorie créée avec succès.');
    }

    /** Formulaire d'édition */
    public function edit(Category $category): Response
    {
        $category->load(['attributes.options']);
        $availableParents = $this->buildParentOptions(true, $category->id);

        $category->attributes->transform(function ($attribute) {
            if (is_string($attribute->validation_rules)) {
                $attribute->validation_rules = json_decode($attribute->validation_rules, true) ?? [];
            }
            return $attribute;
        });

        return Inertia::render('Categories/Edit', [
            'category' => array_merge($category->toArray(), [
                'image_url' => $category->getImageUrl(),
            ]),
            'availableParents' => $availableParents->map(fn ($c) => [
                'id'             => $c->id,
                'name'           => $c->name,
                'level'          => $c->level,
                'indented_name'  => $c->indented_name,
                'full_name'      => $c->full_name,
                'has_children'   => $c->has_children,
            ]),
        ]);
    }

    /** Mise à jour (catégorie + attributs si envoyés) */
    public function update(CategoryRequest $request, Category $category): RedirectResponse
    {
        $validated = $request->validated();

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        // Image
        if ($request->hasFile('image')) {
            if ($category->image_path && Storage::disk('public')->exists($category->image_path)) {
                Storage::disk('public')->delete($category->image_path);
            }
            $validated['image_path'] = $request->file('image')->store('categories', 'public');
        } elseif ($request->boolean('remove_image') && $category->image_path) {
            if (Storage::disk('public')->exists($category->image_path)) {
                Storage::disk('public')->delete($category->image_path);
            }
            $validated['image_path'] = null;
        }

        try {
            DB::transaction(function () use ($category, $validated) {
                // Champs de base (⚠️ on NE touche PAS created_by ici)
                $category->update([
                    'name'             => $validated['name'],
                    'slug'             => $validated['slug'],
                    'parent_id'        => $validated['parent_id'] ?? null,
                    'icon'             => $validated['icon'] ?? null,
                    'description'      => $validated['description'] ?? null,
                    'is_active'        => $validated['is_active'] ?? true,
                    'sort_order'       => $validated['sort_order'] ?? 0,
                    'meta_title'       => $validated['meta_title'] ?? null,
                    'meta_description' => $validated['meta_description'] ?? null,
                    'image_path'       => $validated['image_path'] ?? $category->image_path,
                    // 👇 ajoutés
                    'type'             => $validated['type'] ?? $category->type ?? 'default',
                    'visibility'       => $validated['visibility'] ?? $category->visibility ?? 'public',
                ]);

                // Synchro attributs si envoyés
                if (array_key_exists('attributes', $validated)) {
                    $sentAttributes     = collect($validated['attributes'] ?? []);
                    $existingAttributes = $category->attributes()->with('options')->get();

                    // Supprimer ceux retirés
                    $sentIds = $sentAttributes->filter(fn($attr) => isset($attr['id']))->pluck('id');
                    $existingAttributes->whereNotIn('id', $sentIds)->each(function ($attr) {
                        $attr->options()->delete();
                        $attr->delete();
                    });

                    foreach ($sentAttributes as $index => $attrData) {
                        if (!empty($attrData['id'])) {
                            $attribute = CategoryAttribute::with('options')->find($attrData['id']);
                            if ($attribute && $attribute->category_id === $category->id) {
                                $this->applyAttributeUpdate($attribute, $attrData, $index);
                            }
                        } else {
                            $this->createAttribute($category, $attrData, $index);
                        }
                    }
                }
            });
        } catch (\Throwable $e) {
            Log::error('Category update failed', [
                'category_id' => $category->id,
                'error'       => $e->getMessage(),
                'trace'       => $e->getTraceAsString()
            ]);
            return back()->with('error', 'Une erreur est survenue lors de la mise à jour.')->withInput();
        }

        return redirect()->route('categories.show', $category)->with('success', 'Catégorie mise à jour avec succès.');
    }

    /** Affichage */
    public function show(Category $category): Response
    {
        $category->load(['parent', 'children', 'attributes.options', 'creator:id,name']); // ✅

        $products = $category->products()
            ->with(['brand', 'currency'])
            ->where('is_active', true)
            ->paginate(12);

        $user = Auth::user();

        return Inertia::render('Categories/Show', [
            'category' => array_merge($category->toArray(), [
                'image_url' => $category->getImageUrl(),
                'full_name' => $category->getFullName(),
                'depth'     => $category->getDepth(),
            ]),
            'products' => $products,
            'can' => [
                'update'        => $user?->can('update', $category) ?? false,
                'delete'        => $user?->can('delete', $category) ?? false,
                'create'        => $user?->can('create', Category::class) ?? false,
                'category_edit' => $user?->can('category_edit') ?? false,
            ],
        ]);
    }

    public function destroy(Category $category): RedirectResponse
    {
        if ($category->products()->count() > 0) {
            return back()->with('error', 'Impossible de supprimer une catégorie contenant des produits.');
        }
        if ($category->children()->count() > 0) {
            return back()->with('error', 'Impossible de supprimer une catégorie ayant des sous-catégories.');
        }

        $category->delete();

        return back()->with('success', 'Catégorie supprimée.');
    }

    public function restore($id): RedirectResponse
    {
        $category = Category::withTrashed()->findOrFail($id);
        $category->restore();

        return back()->with('success', 'Catégorie restaurée.');
    }

    public function forceDelete($id): RedirectResponse
    {
        $category = Category::withTrashed()->findOrFail($id);

        if ($category->products()->withTrashed()->count() > 0) {
            return back()->with('error', 'Impossible de supprimer définitivement une catégorie ayant des produits.');
        }

        if ($category->image_path && Storage::disk('public')->exists($category->image_path)) {
            Storage::disk('public')->delete($category->image_path);
        }

        $category->forceDelete();

        return back()->with('success', 'Catégorie supprimée définitivement.');
    }

    /** Liste des attributs (page Inertia – nécessite une route web avec {category}) */
    public function attributes(Category $category): Response
    {
        $attributes = $category->attributes()
            ->with('options')
            ->orderBy('sort_order')
            ->get();

        return Inertia::render('Categories/Attributes', [
            'category'   => $category,
            'attributes' => $attributes,
        ]);
    }

    /** Créer un attribut (endpoint granulaire) */
    public function storeAttribute(Request $request, Category $category): RedirectResponse
    {
        $validated = $request->validate([
            'name'               => 'required|string|max:255',
            'slug'               => 'nullable|string|max:255|unique:category_attributes,slug,NULL,id,category_id,' . $category->id,
            'type'               => 'required|in:text,textarea,number,decimal,boolean,select,multiselect,date,url,email,json',
            'description'        => 'nullable|string',
            'unit'               => 'nullable|string|max:20',
            'default_value'      => 'nullable|string',
            'validation_rules'   => 'nullable|array',
            'is_required'        => 'boolean',
            'is_filterable'      => 'boolean',
            'is_searchable'      => 'boolean',
            'show_in_listing'    => 'boolean',
            'sort_order'         => 'nullable|integer|min:0',
            'options'            => 'nullable|array',
            'options.*.label'    => 'required_with:options|string',
            'options.*.value'    => 'required_with:options|string',
            'options.*.color'    => 'nullable|string|max:20',
            'options.*.is_active'=> 'sometimes|boolean',
            'options.*.sort_order'=> 'nullable|integer|min:0',
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        try {
            DB::transaction(function () use ($category, $validated) {
                $attribute = $category->attributes()->create($validated);

                if (in_array($validated['type'], ['select', 'multiselect'], true) && !empty($validated['options'])) {
                    foreach ($validated['options'] as $index => $option) {
                        $attribute->options()->create([
                            'label'      => $option['label'],
                            'value'      => $option['value'],
                            'color'      => $option['color'] ?? null,
                            'is_active'  => (bool)($option['is_active'] ?? true),
                            'sort_order' => array_key_exists('sort_order', $option) ? (int)$option['sort_order'] : $index,
                        ]);
                    }
                }
            });
        } catch (\Throwable $e) {
            Log::error('Store attribute failed', ['category_id' => $category->id, 'error' => $e->getMessage()]);
            return back()->with('error', 'Erreur lors de la création de l\'attribut.')->withInput();
        }

        return back()->with('success', 'Attribut créé avec succès.');
    }

    /** Mettre à jour un attribut (endpoint granulaire) */
    public function updateAttribute(Request $request, Category $category, CategoryAttribute $attribute): RedirectResponse
    {
        $validated = $request->validate([
            'name'               => 'required|string|max:255',
            'slug'               => 'required|string|max:255|unique:category_attributes,slug,' . $attribute->id . ',id,category_id,' . $category->id,
            'type'               => 'required|in:text,textarea,number,decimal,boolean,select,multiselect,date,url,email,json',
            'description'        => 'nullable|string',
            'unit'               => 'nullable|string|max:20',
            'default_value'      => 'nullable|string',
            'validation_rules'   => 'nullable|array',
            'is_required'        => 'boolean',
            'is_filterable'      => 'boolean',
            'is_searchable'      => 'boolean',
            'show_in_listing'    => 'boolean',
            'sort_order'         => 'nullable|integer|min:0',
            'options'            => 'nullable|array',
            'options.*.label'    => 'required_with:options|string',
            'options.*.value'    => 'required_with:options|string',
            'options.*.color'    => 'nullable|string|max:20',
            'options.*.is_active'=> 'sometimes|boolean',
            'options.*.sort_order'=> 'nullable|integer|min:0',
        ]);

        try {
            DB::transaction(function () use ($attribute, $validated) {
                $attribute->update($validated);

                if (in_array($validated['type'], ['select', 'multiselect'], true)) {
                    $attribute->options()->delete();

                    if (!empty($validated['options'])) {
                        foreach ($validated['options'] as $index => $option) {
                            $attribute->options()->create([
                                'label'      => $option['label'],
                                'value'      => $option['value'],
                                'color'      => $option['color'] ?? null,
                                'is_active'  => (bool)($option['is_active'] ?? true),
                                'sort_order' => array_key_exists('sort_order', $option) ? (int)$option['sort_order'] : $index,
                            ]);
                        }
                    }
                } else {
                    // Si le type n'est plus à options, on nettoie
                    $attribute->options()->delete();
                }
            });
        } catch (\Throwable $e) {
            Log::error('Update attribute failed', ['attribute_id' => $attribute->id, 'error' => $e->getMessage()]);
            return back()->with('error', 'Erreur lors de la mise à jour de l\'attribut.')->withInput();
        }

        return back()->with('success', 'Attribut mis à jour avec succès.');
    }

    /** Sync attributs séparément (appelé par le bouton "Enregistrer les attributs") */
    public function syncAttributes(SyncCategoryAttributesRequest $request, Category $category): RedirectResponse
    {
        $validated = $request->validated();

        try {
            DB::transaction(function () use ($category, $validated) {
                $sentAttributes = collect($validated['attributes'] ?? []);
                $existing       = $category->attributes()->with('options')->get();

                // Supprimer ceux non envoyés
                $sentIds = $sentAttributes->filter(fn($a) => !empty($a['id']))->pluck('id');
                $existing->whereNotIn('id', $sentIds)->each(function ($attr) {
                    $attr->options()->delete();
                    $attr->delete();
                });

                // Upsert
                foreach ($sentAttributes as $index => $attrData) {
                    if (!empty($attrData['id'])) {
                        $attribute = CategoryAttribute::with('options')->find($attrData['id']);
                        if ($attribute && $attribute->category_id === $category->id) {
                            $this->applyAttributeUpdate($attribute, $attrData, $index);
                        }
                    } else {
                        $this->createAttribute($category, $attrData, $index);
                    }
                }
            });
        } catch (\Throwable $e) {
            Log::error('Attributes sync failed', ['category_id' => $category->id, 'error' => $e->getMessage()]);
            return back()->with('error', 'Erreur lors de la mise à jour des attributs.');
        }

        return back()->with('success', 'Attributs mis à jour avec succès.');
    }

    /* -----------------------------------------------------------------
     | Helpers privés pour les attributs
     ------------------------------------------------------------------*/
    private function createAttribute(Category $category, array $attrData, int $index): void
    {
        $attribute = $category->attributes()->create([
            'name'            => $attrData['name'],
            'slug'            => $attrData['slug'] ?: Str::slug($attrData['name']),
            'type'            => $attrData['type'],
            'unit'            => $attrData['unit'] ?? null,
            'description'     => $attrData['description'] ?? null,
            'is_required'     => (bool)($attrData['is_required'] ?? false),
            'is_filterable'   => (bool)($attrData['is_filterable'] ?? false),
            'is_searchable'   => (bool)($attrData['is_searchable'] ?? false),
            'show_in_listing' => (bool)($attrData['show_in_listing'] ?? false),
            'is_active'       => (bool)($attrData['is_active'] ?? true),
            'sort_order'      => $attrData['sort_order'] ?? $index,
            'default_value'   => $attrData['default_value'] ?? null,
            'validation_rules'=> is_array($attrData['validation_rules'] ?? null)
                ? json_encode($attrData['validation_rules'])
                : null,
        ]);

        $this->syncAttributeOptions($attribute, $attrData);
    }

    private function applyAttributeUpdate(CategoryAttribute $attribute, array $attrData, int $index): void
    {
        $attribute->update([
            'name'            => $attrData['name'],
            'slug'            => $attrData['slug'] ?: Str::slug($attrData['name']),
            'type'            => $attrData['type'],
            'unit'            => $attrData['unit'] ?? null,
            'description'     => $attrData['description'] ?? null,
            'is_required'     => (bool)($attrData['is_required'] ?? false),
            'is_filterable'   => (bool)($attrData['is_filterable'] ?? false),
            'is_searchable'   => (bool)($attrData['is_searchable'] ?? false),
            'show_in_listing' => (bool)($attrData['show_in_listing'] ?? false),
            'is_active'       => (bool)($attrData['is_active'] ?? true),
            'sort_order'      => $attrData['sort_order'] ?? $index,
            'default_value'   => $attrData['default_value'] ?? null,
            'validation_rules'=> is_array($attrData['validation_rules'] ?? null)
                ? json_encode($attrData['validation_rules'])
                : null,
        ]);

        $this->syncAttributeOptions($attribute, $attrData);
    }

    private function syncAttributeOptions(CategoryAttribute $attribute, array $attrData): void
    {
        if (!in_array($attrData['type'], ['select', 'multiselect'], true)) {
            $attribute->options()->delete();
            return;
        }

        $sentOptions = collect($attrData['options'] ?? []);

        // Supprimer les options non envoyées
        $sentIds = $sentOptions->filter(fn($opt) => isset($opt['id']))->pluck('id');
        $attribute->options()->whereNotIn('id', $sentIds)->delete();

        // Upsert / create options
        foreach ($sentOptions as $index => $optData) {
            if (empty($optData['label'])) continue;

            $optionData = [
                'label'      => $optData['label'],
                'value'      => $optData['value'] ?: Str::slug($optData['label']),
                'color'      => $optData['color'] ?? null,
                'is_active'  => (bool)($optData['is_active'] ?? true),
                'sort_order' => $optData['sort_order'] ?? $index,
            ];

            if (!empty($optData['id'])) {
                $option = $attribute->options()->whereKey($optData['id'])->first();
                if ($option) {
                    $option->update($optionData);
                    continue;
                }
            }

            $attribute->options()->create($optionData);
        }
    }

    /* -----------------------------------------------------------------
     | Helpers privés (parents)
     ------------------------------------------------------------------*/
    private function buildParentOptions(bool $onlyActive = false, ?int $exceptId = null)
    {
        $query = Category::query()
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($onlyActive) {
            $query->where('is_active', true);
        }
        if ($exceptId) {
            $query->where('id', '<>', $exceptId);
        }

        $all      = $query->get(['id', 'name', 'parent_id']);
        $byParent = $all->groupBy('parent_id');
        $result   = collect();

        $walk = function ($parentId, $level) use (&$walk, $byParent, &$result, $exceptId) {
            $children = $byParent->get($parentId, collect());

            foreach ($children as $cat) {
                if ($exceptId && $this->isDescendantOf($exceptId, $cat->id)) {
                    continue;
                }

                $hasChildren        = ($byParent->get($cat->id, collect())->count() > 0);
                $fullName           = $this->computeFullName($cat, $byParent);
                $indented           = str_repeat('— ', $level) . $cat->name;

                $cat->level         = $level;
                $cat->indented_name = $indented;
                $cat->full_name     = $fullName;
                $cat->has_children  = $hasChildren;

                $result->push($cat);
                $walk($cat->id, $level + 1);
            }
        };

        // Racines
        $walk(null, 0);

        return $result;
    }

    private function computeFullName($cat, $byParent): string
    {
        $names   = [$cat->name];
        $current = $cat;

        // Remonter jusqu'à la racine
        $guard = 0;
        while ($current && $current->parent_id && $guard < 100) {
            $parent = $byParent->flatten()->firstWhere('id', $current->parent_id);
            if (!$parent) break;
            array_unshift($names, $parent->name);
            $current = $parent;
            $guard++;
        }

        return implode(' > ', $names);
    }

    private function isDescendantOf(int $categoryId, int $potentialParentId): bool
    {
        if ($categoryId === $potentialParentId) {
            return true;
        }

        $current = Category::find($potentialParentId);
        $guard   = 0;

        while ($current && $current->parent_id && $guard < 100) {
            if ((int)$current->parent_id === $categoryId) {
                return true;
            }
            $current = Category::find($current->parent_id);
            $guard++;
        }

        return false;
    }

    /** API: attributs d’une catégorie (sans héritage) */
    public function apiAttributes(Category $category): JsonResponse
    {
        $attrs = $category->attributes()
            ->where('is_active', true)
            ->with(['options' => fn($q) => $q->active()->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'attributes' => $attrs,
        ]);
    }
}
