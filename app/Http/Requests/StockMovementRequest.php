<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StockMovementRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if (!$user) return false;

        // Aligne les permissions avec web.php
        if ($this->isMethod('post') || $this->routeIs('stock-movements.store')) {
            return $user->can('stock_movement_create');
        }

        if ($this->isMethod('patch') || $this->isMethod('put') || $this->routeIs('stock-movements.update')) {
            return $user->can('stock_movement_edit');
        }

        if ($this->isMethod('delete') || $this->routeIs('stock-movements.destroy')) {
            return $user->can('stock_movement_delete');
        }

        // autres cas (show/index), pas utilisé ici :
        return true;
    }

    public function rules(): array
    {
        return [
            // ⚠️ Retire 'uuid' si tes IDs produits sont des INT (sélectionnés via <option value="{id}">)
            'product_id'    => ['required', 'exists:products,id'],

            'type'          => ['required', 'in:in,out,adjustment'],

            // quantité : signe géré + règles cohérentes
            'quantity'      => ['required', 'numeric', function ($att, $val, $fail) {
                $type = $this->input('type');
                if ($type === 'out' && $val >= 0) {
                    $fail('La quantité doit être négative pour une sortie de stock.');
                }
                if (in_array($type, ['in','adjustment'], true) && (float)$val === 0.0) {
                    $fail('La quantité ne peut pas être zéro.');
                }
            }],

            'reference'     => ['nullable', 'string', 'max:255'],

            'provider_id'   => ['nullable', 'exists:providers,id'],
            'reason_id'     => ['required', 'exists:stock_movement_reasons,id'],

            'unit_cost'     => ['nullable', 'numeric', 'min:0'],
            'currency_code' => ['required', 'exists:currencies,code', 'size:3'],
            'notes'         => ['nullable', 'string'],
            'movement_date' => ['required', 'date'],

            // Pièces jointes
            'attachments'        => ['nullable', 'array', 'max:5'],
            'attachments.*'      => ['file','mimes:pdf,jpg,jpeg,png,doc,docx,xls,xlsx','max:5120'],

            // ⚠️ Aligne avec le contrôleur (StockMovementController::update)
            'deleted_attachment_ids'   => ['nullable', 'array'],
            'deleted_attachment_ids.*' => ['integer','exists:stock_movement_attachments,id'],
        ];
    }

    protected function prepareForValidation(): void
    {
        // Force la sortie en négatif si l’utilisateur a saisi une valeur positive
        if ($this->input('type') === 'out') {
            $q = $this->input('quantity');
            if (is_numeric($q) && $q > 0) {
                $this->merge(['quantity' => -abs($q)]);
            }
        }
    }
}
