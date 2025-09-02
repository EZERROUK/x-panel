<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SyncCategoryAttributesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // adapte à ta Policy si besoin
    }

    public function rules(): array
    {
        return [
            'attributes'                         => ['nullable','array'],
            'attributes.*.id'                    => ['nullable','integer','exists:category_attributes,id'],
            'attributes.*.name'                  => ['required','string','max:255'],
            'attributes.*.slug'                  => ['nullable','string','max:255'],
            'attributes.*.type'                  => ['required','in:text,textarea,number,decimal,boolean,select,multiselect,date,url,email,json'],
            'attributes.*.unit'                  => ['nullable','string','max:50'],
            'attributes.*.description'           => ['nullable','string','max:1000'],
            'attributes.*.default_value'         => ['nullable','string','max:255'],
            'attributes.*.is_required'           => ['boolean'],
            'attributes.*.is_filterable'         => ['boolean'],
            'attributes.*.is_searchable'         => ['boolean'],
            'attributes.*.show_in_listing'       => ['boolean'],
            'attributes.*.is_active'             => ['boolean'],
            'attributes.*.sort_order'            => ['nullable','integer','min:0'],
            'attributes.*.validation_rules'      => ['nullable','array'],

            'attributes.*.options'               => ['nullable','array'],
            'attributes.*.options.*.id'          => ['nullable','integer','exists:attribute_options,id'],
            'attributes.*.options.*.label'       => ['required_with:attributes.*.options','string','max:255'],
            'attributes.*.options.*.value'       => ['nullable','string','max:255'],
            'attributes.*.options.*.color'       => ['nullable','string','max:20'],
            'attributes.*.options.*.is_active'   => ['boolean'],
            'attributes.*.options.*.sort_order'  => ['nullable','integer','min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'attributes.*.name.required' => 'Le nom de l\'attribut est obligatoire.',
            'attributes.*.type.required' => 'Le type de l\'attribut est obligatoire.',
            'attributes.*.type.in' => 'Le type sélectionné n\'est pas valide.',
            'attributes.*.options.*.label.required_with' => 'Le label de l\'option est obligatoire.',
        ];
    }
}
