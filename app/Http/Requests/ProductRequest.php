<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return match ($this->method()) {
            'POST'          => $this->user()->can('product_create'),
            'PATCH', 'PUT'  => $this->user()->can('product_edit'),
            'DELETE'        => $this->user()->can('product_delete'),
            default         => true,
        };
    }

    public function rules(): array
    {
        $productId = $this->route('product')?->id;

        $rules = [
            // Champs de base
            'name'              => ['required','string','max:255'],
            'model'             => ['nullable','string','max:255'],
            'sku'               => ['required','string','max:100', $productId ? "unique:products,sku,{$productId}" : 'unique:products,sku'],
            'slug'              => ['nullable','string','max:255','regex:/^[a-z0-9-]+$/', $productId ? "unique:products,slug,{$productId}" : 'unique:products,slug'],
            'description'       => ['nullable','string'],
            'meta_title'        => ['nullable','string','max:255'],
            'meta_description'  => ['nullable','string','max:500'],
            'meta_keywords'     => ['nullable','string'],

            // Relations
            'brand_id'      => ['nullable','exists:brands,id'],
            'category_id'   => ['required','exists:categories,id'],
            'currency_code' => ['required','exists:currencies,code'],
            'tax_rate_id'   => ['required','exists:tax_rates,id'],

            // Pricing
            'price'            => ['required','numeric','min:0','max:999999.99'],
            'compare_at_price' => ['nullable','numeric','min:0','max:999999.99','gt:price'],
            'cost_price'       => ['nullable','numeric','min:0','max:999999.99'],

            // Tolérance sur le prix
            'min_tolerance_type'  => ['nullable','in:percentage,amount'],
            'min_tolerance_value' => ['nullable','numeric','min:0'],

            // E-commerce
            'type'            => ['required','in:physical,digital,service'],
            'visibility'      => ['required','in:public,hidden,draft'],
            'is_active'       => ['sometimes','boolean'],
            'has_variants'    => ['sometimes','boolean'],
            'is_featured'     => ['sometimes','boolean'],
            'available_from'  => ['nullable','date'],
            'available_until' => ['nullable','date','after:available_from'],

            // Inventory
            'stock_quantity'      => ['required','integer','min:0'],
            'track_inventory'     => ['sometimes','boolean'],
            'low_stock_threshold' => ['nullable','integer','min:0'],
            'allow_backorder'     => ['sometimes','boolean'],

            // Physical product fields
            'weight' => ['nullable','numeric','min:0'],
            'length' => ['nullable','numeric','min:0'],
            'width'  => ['nullable','numeric','min:0'],
            'height' => ['nullable','numeric','min:0'],

            // Digital product fields
            'download_url'         => ['nullable','url','max:500'],
            'download_limit'       => ['nullable','integer','min:1'],
            'download_expiry_days' => ['nullable','integer','min:1'],

            // Images
            'images'               => ['nullable','array'],
            'images.*'             => ['image','mimes:jpeg,png,jpg,webp','max:5120'],
            'primary_image_index'  => ['nullable','integer','min:0'],
            'deleted_image_ids'    => ['nullable','array'],
            'deleted_image_ids.*'  => ['integer','exists:product_images,id'],
            'restored_image_ids'   => ['nullable','array'],
            'restored_image_ids.*' => ['integer','exists:product_images,id'],

            // Compatibilités (schéma avancé avec note/direction)
            'compatibilities'                        => ['nullable','array'],
            'compatibilities.*.compatible_with_id'   => ['required','exists:products,id'],
            'compatibilities.*.direction'            => ['nullable','in:bidirectional,uni'],
            'compatibilities.*.note'                 => ['nullable','string','max:500'],

            // Compatibilités (simplifié : liste d’IDs)
            'compatibility_product_ids'   => ['nullable','array'],
            'compatibility_product_ids.*' => ['uuid','distinct','exists:products,id'],

            // Catégories multiples
            'additional_categories'   => ['nullable','array'],
            'additional_categories.*' => ['exists:categories,id'],

            // Attributs personnalisés (validation dynamique)
            'attributes' => ['nullable','array'],
        ];

        // Règles conditionnelles pour la tolérance
        if ($this->filled('min_tolerance_type')) {
            $rules['min_tolerance_value'][] = 'required';
            if ($this->input('min_tolerance_type') === 'percentage') {
                $rules['min_tolerance_value'][] = 'max:100';
            }
        }
        if ($this->filled('min_tolerance_value')) {
            $rules['min_tolerance_type'][] = 'required';
        }

        // Validation dynamique des attributs personnalisés selon la catégorie
        if ($this->filled('category_id')) {
            $category = \App\Models\Category::with('attributes.options')->find($this->input('category_id'));

            if ($category) {
                foreach ($category->attributes as $attribute) {
                    $rules["attributes.{$attribute->slug}"] = $attribute->getValidationRulesArray();
                }
            }
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'sku.unique'                 => 'Ce SKU est déjà utilisé par un autre produit.',
            'slug.unique'                => 'Ce slug est déjà utilisé par un autre produit.',
            'slug.regex'                 => 'Le slug ne peut contenir que des lettres minuscules, chiffres et tirets.',
            'compare_at_price.gt'        => 'Le prix comparé doit être supérieur au prix de vente.',
            'available_until.after'      => 'La date de fin de disponibilité doit être postérieure à la date de début.',
            'images.*.max'               => 'Chaque image ne doit pas dépasser 5 MB.',
            'download_url.url'           => "L'URL de téléchargement doit être valide.",
            'attributes.*.required'      => 'Ce champ est requis.',
            'attributes.*.in'            => 'La valeur sélectionnée n\'est pas valide.',
            'visibility.in'              => 'Visibilité invalide (public, hidden, draft).',
            'type.in'                    => 'Type invalide (physical, digital, service).',
            'min_tolerance_type.required'  => 'Le type de tolérance est requis lorsque la valeur est renseignée.',
            'min_tolerance_type.in'        => 'Type de tolérance invalide (percentage ou amount).',
            'min_tolerance_value.required' => 'La valeur de tolérance est requise lorsque le type est renseigné.',
            'min_tolerance_value.numeric'  => 'La valeur de tolérance doit être un nombre.',
            'min_tolerance_value.min'      => 'La valeur de tolérance doit être supérieure ou égale à 0.',
            'min_tolerance_value.max'      => 'Pour un type "percentage", la valeur doit être comprise entre 0 et 100.',
        ];
    }

    protected function prepareForValidation(): void
    {
        // Slug auto si manquant
        if ($this->filled('name') && !$this->filled('slug')) {
            $this->merge([
                'slug' => \Illuminate\Support\Str::slug($this->input('name')),
            ]);
        }

        // Valeurs par défaut pour type/visibility si absentes
        $this->merge([
            'type'       => $this->input('type', 'physical'),
            'visibility' => $this->input('visibility', 'public'),
        ]);

        // Conversion des booléens
        foreach (['is_active','is_featured','track_inventory','allow_backorder','has_variants'] as $field) {
            if ($this->has($field)) {
                $this->merge([
                    $field => filter_var($this->input($field), FILTER_VALIDATE_BOOLEAN),
                ]);
            }
        }
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $currentId = $this->route('product')?->id;

            // Empêche l’auto-lien si on a l’ID courant
            if ($currentId) {
                $ids = collect($this->input('compatibility_product_ids', []))
                    ->merge(collect($this->input('compatibilities', []))->pluck('compatible_with_id'))
                    ->filter()
                    ->unique()
                    ->values();

                if ($ids->contains($currentId)) {
                    $v->errors()->add('compatibility_product_ids', 'Un produit ne peut pas être compatible avec lui-même.');
                }
            }
        });
    }
}
