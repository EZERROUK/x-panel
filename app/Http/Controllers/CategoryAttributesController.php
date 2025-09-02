<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\CategoryAttribute;
use App\Http\Requests\SyncCategoryAttributesRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class CategoryAttributesController extends Controller
{
    public function edit(Category $category): Response
    {
        $category->load('attributes.options');

        $attrs = $category->attributes->map(function ($a) {
            if (is_string($a->validation_rules)) {
                $a->validation_rules = json_decode($a->validation_rules, true) ?? [];
            }
            return $a;
        });

        return Inertia::render('Categories/Attributes/Edit', [
            'category'   => ['id' => $category->id, 'name' => $category->name],
            'attributes' => $attrs,
        ]);
    }

    public function sync(SyncCategoryAttributesRequest $request, Category $category): RedirectResponse
    {
        try {
            $validated = $request->validated();

            Log::info('Sync attributes request:', $validated);

            DB::transaction(function () use ($category, $validated) {
                $sent = collect($validated['attributes'] ?? []);
                $existing = $category->attributes()->with('options')->get();

                // delete missing
                $sentIds = $sent->pluck('id')->filter()->values();
                $existing->whereNotIn('id', $sentIds)->each(function ($attr) {
                    Log::info("Deleting attribute: {$attr->id}");
                    $attr->options()->delete();
                    $attr->delete();
                });

                // upsert
                foreach ($sent as $index => $attr) {
                    if (!empty($attr['id'])) {
                        $attribute = CategoryAttribute::with('options')->find($attr['id']);
                        if ($attribute && $attribute->category_id === $category->id) {
                            Log::info("Updating attribute: {$attribute->id}");
                            $this->applyAttributeUpdate($attribute, $attr, $index);
                        }
                    } else {
                        Log::info("Creating new attribute: {$attr['name']}");
                        $this->createAttribute($category, $attr, $index);
                    }
                }
            });

            return redirect()->route('categories.show', $category->id)
                           ->with('success', 'Attributs mis à jour avec succès.');

        } catch (\Exception $e) {
            Log::error('Error syncing attributes:', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return back()->withErrors(['error' => 'Une erreur est survenue lors de la mise à jour des attributs.']);
        }
    }

    // --- helpers attributs (copiés de ton contrôleur actuel) ---
    private function createAttribute(Category $category, array $attr, int $index): void
    {
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
            'validation_rules'=> is_array($attr['validation_rules'] ?? null) ? json_encode($attr['validation_rules']) : null,
        ]);

        $this->syncOptions($attribute, $attr);
    }

    private function applyAttributeUpdate(CategoryAttribute $attribute, array $attr, int $index): void
    {
        $attribute->update([
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
            'validation_rules'=> is_array($attr['validation_rules'] ?? null) ? json_encode($attr['validation_rules']) : null,
        ]);

        $this->syncOptions($attribute, $attr);
    }

    private function syncOptions(CategoryAttribute $attribute, array $attr): void
    {
        if (!in_array($attr['type'], ['select','multiselect'], true)) {
            $attribute->options()->delete();
            return;
        }

        $sent = collect($attr['options'] ?? []);

        // delete missing
        $sentIds = $sent->pluck('id')->filter()->values();
        $attribute->options()->whereNotIn('id', $sentIds)->delete();

        // upsert
        foreach ($sent as $i => $opt) {
            if (empty($opt['label'])) continue;

            $payload = [
                'label'      => $opt['label'],
                'value'      => $opt['value'] ?: Str::slug($opt['label']),
                'color'      => $opt['color'] ?? null,
                'is_active'  => (bool)($opt['is_active'] ?? true),
                'sort_order' => $opt['sort_order'] ?? $i,
            ];

            if (!empty($opt['id'])) {
                $existing = $attribute->options()->whereKey($opt['id'])->first();
                if ($existing) {
                    Log::info("Updating option: {$existing->id}");
                    $existing->update($payload);
                } else {
                    Log::info("Creating new option (id not found): {$opt['label']}");
                    $attribute->options()->create($payload);
                }
            } else {
                Log::info("Creating new option: {$opt['label']}");
                $attribute->options()->create($payload);
            }
        }
    }
}
