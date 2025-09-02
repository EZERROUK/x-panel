<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;

class CategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Robuste aux _method=PATCH/PUT/DELETE
        if ($this->isMethod('POST')) {
            return $this->user()->can('category_create');
        }
        if ($this->isMethod('PATCH') || $this->isMethod('PUT')) {
            return $this->user()->can('category_edit');
        }
        if ($this->isMethod('DELETE')) {
            return $this->user()->can('category_delete');
        }
        return true;
    }

    public function rules(): array
    {
        $categoryId = $this->route('category')?->id;

        return [
            // ---------- Catégorie ----------
            'name' => [
                'required','string','max:255',
                Rule::unique('categories', 'name')->ignore($categoryId),
            ],
            'slug' => [
                'nullable','string','max:255','regex:/^[a-z0-9-]+$/',
                Rule::unique('categories', 'slug')->ignore($categoryId),
            ],
            'description' => ['nullable', 'string'],
            'parent_id' => [
                'nullable','integer','exists:categories,id',
                ...($categoryId ? [Rule::notIn([$categoryId])] : []),
            ],

            // Image
            'image' => ['nullable','image','mimes:jpeg,png,jpg,webp','max:4096'],
            'remove_image' => ['sometimes','boolean'],

            'meta_title' => ['nullable','string','max:255'],
            'meta_description' => ['nullable','string','max:1000'],
            'is_active' => ['sometimes','boolean'],
            'sort_order' => ['nullable','integer','min:0'],
            'icon' => ['nullable','string','max:255'],

            // 👇 Nouveaux champs
            'type' => ['nullable','string','max:50'],             // ex: "default" (aucune restriction stricte ici)
            'visibility' => ['nullable','in:public,private'],     // enum cohérente avec la migration

            // ---------- Attributs imbriqués ----------
            'attributes' => ['nullable','array'],
            'attributes.*.id' => ['nullable','integer','exists:category_attributes,id'],
            'attributes.*.name' => ['required_with:attributes.*','string','max:255'],
            'attributes.*.slug' => ['nullable','string','max:255','regex:/^[a-z0-9-]+$/'],
            'attributes.*.type' => ['required_with:attributes.*','in:text,textarea,number,decimal,boolean,select,multiselect,date,url,email,json'],
            'attributes.*.description' => ['nullable','string'],
            'attributes.*.unit' => ['nullable','string','max:20'],
            'attributes.*.default_value' => ['nullable','string'],
            'attributes.*.validation_rules' => ['nullable'],
            'attributes.*.is_required' => ['sometimes','boolean'],
            'attributes.*.is_filterable' => ['sometimes','boolean'],
            'attributes.*.is_searchable' => ['sometimes','boolean'],
            'attributes.*.show_in_listing' => ['sometimes','boolean'],
            'attributes.*.is_active' => ['sometimes','boolean'],
            'attributes.*.sort_order' => ['nullable','integer','min:0'],

            // Options (select/multiselect)
            'attributes.*.options' => ['nullable','array'],
            'attributes.*.options.*.id' => ['nullable','integer','exists:category_attribute_options,id'],
            'attributes.*.options.*.label' => ['required_with:attributes.*.options.*','string','max:255'],
            'attributes.*.options.*.value' => ['required_with:attributes.*.options.*','string','max:255','regex:/^[a-z0-9-_.]+$/'],
            'attributes.*.options.*.color' => ['nullable','string','max:20'],
            'attributes.*.options.*.sort_order' => ['nullable','integer','min:0'],
            'attributes.*.options.*.is_active' => ['sometimes','boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            // Catégorie
            'slug.unique' => 'Ce slug est déjà utilisé par une autre catégorie.',
            'slug.regex' => 'Le slug ne peut contenir que des lettres minuscules, chiffres et tirets.',
            'parent_id.not_in' => 'Une catégorie ne peut pas être son propre parent.',
            'image.max' => "L'image ne doit pas dépasser 4 MB.",
            // Nouveaux champs
            'visibility.in' => 'La visibilité doit être "public" ou "private".',

            // Attributs
            'attributes.*.name.required_with' => "Le nom de l'attribut est requis.",
            'attributes.*.slug.regex' => "Le slug d'attribut ne peut contenir que minuscules, chiffres et tirets.",
            'attributes.*.type.required_with' => "Le type de l'attribut est requis.",
            'attributes.*.type.in' => "Type d'attribut invalide.",
            'attributes.*.options.*.label.required_with' => "Chaque option doit avoir un libellé.",
            'attributes.*.options.*.value.required_with' => "Chaque option doit avoir une valeur.",
            'attributes.*.options.*.value.regex' => "La valeur d'option ne peut contenir que minuscules, chiffres, tirets, underscores et points.",
        ];
    }

    protected function prepareForValidation(): void
    {
        // Slug auto si manquant
        if ($this->filled('name') && !$this->filled('slug')) {
            $this->merge(['slug' => Str::slug($this->input('name'))]);
        }

        // Parent vide -> null
        if ($this->has('parent_id') && ($this->input('parent_id') === '' || $this->input('parent_id') === null)) {
            $this->merge(['parent_id' => null]);
        }

        // is_active string -> bool
        if ($this->has('is_active')) {
            $this->merge([
                'is_active' => filter_var($this->input('is_active'), FILTER_VALIDATE_BOOLEAN),
            ]);
        }

        // remove_image string -> bool
        if ($this->has('remove_image')) {
            $this->merge([
                'remove_image' => filter_var($this->input('remove_image'), FILTER_VALIDATE_BOOLEAN),
            ]);
        }

        // Défauts sûrs pour les nouveaux champs si non fournis
        if (!$this->has('type') || $this->input('type') === null || $this->input('type') === '') {
            $this->merge(['type' => 'default']);
        }
        if (!$this->has('visibility') || $this->input('visibility') === null || $this->input('visibility') === '') {
            $this->merge(['visibility' => 'public']);
        }

        // Normaliser les attributs imbriqués
        if (is_array($this->input('attributes'))) {
            $attributes = $this->input('attributes');
            $normalizedAttributes = [];

            foreach ($attributes as $attr) {
                if (!is_array($attr)) {
                    continue;
                }

                // Ignorer les attributs totalement vides
                $isEmpty =
                    (!isset($attr['name']) || trim($attr['name']) === '') &&
                    (!isset($attr['slug']) || trim($attr['slug']) === '') &&
                    (empty($attr['options']) || !is_array($attr['options']));

                if ($isEmpty) {
                    continue;
                }

                // id attribut -> int si présent
                if (isset($attr['id']) && $attr['id'] !== '') {
                    $attr['id'] = (int) $attr['id'];
                }

                // Slug auto si manquant
                if (empty($attr['slug']) && !empty($attr['name'])) {
                    $attr['slug'] = Str::slug($attr['name']);
                }

                // Booléens -> vrais bool
                foreach (['is_required','is_filterable','is_searchable','show_in_listing','is_active'] as $flag) {
                    if (array_key_exists($flag, $attr)) {
                        $attr[$flag] = filter_var($attr[$flag], FILTER_VALIDATE_BOOLEAN);
                    }
                }

                // Tri / sort_order numérique
                if (array_key_exists('sort_order', $attr) && $attr['sort_order'] !== null && $attr['sort_order'] !== '') {
                    $attr['sort_order'] = (int) $attr['sort_order'];
                }

                // Nettoyer les options si présentes
                if (!empty($attr['options']) && is_array($attr['options'])) {
                    $cleanOptions = [];
                    foreach ($attr['options'] as $optIndex => $opt) {
                        if (is_array($opt) && !empty($opt['label']) && !empty($opt['value'])) {
                            $cleanOptions[] = [
                                'id' => isset($opt['id']) && $opt['id'] !== '' ? (int)$opt['id'] : null,
                                'label' => trim($opt['label']),
                                'value' => trim($opt['value']),
                                'color' => $opt['color'] ?? null,
                                'sort_order' => isset($opt['sort_order']) ? (int)$opt['sort_order'] : $optIndex,
                                'is_active' => isset($opt['is_active']) ? filter_var($opt['is_active'], FILTER_VALIDATE_BOOLEAN) : true,
                            ];
                        }
                    }
                    $attr['options'] = $cleanOptions;
                }

                $normalizedAttributes[] = $attr;
            }

            $this->merge(['attributes' => $normalizedAttributes]);
        }
    }
}
