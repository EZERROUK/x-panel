<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class OrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return match ($this->method()) {
            'POST'   => $this->user()->can('order_create'),
            'PATCH'  => $this->user()->can('order_edit'),
            'DELETE' => $this->user()->can('order_delete'),
            default  => true,
        };
    }

    public function rules(): array
    {
        return [
            'client_id'              => 'required|exists:clients,id',
            'order_date'             => 'required|date',
            'expected_delivery_date' => 'nullable|date|after_or_equal:order_date',
            'currency_code'          => 'required|exists:currencies,code',
            'notes'                  => 'nullable|string',
            'internal_notes'         => 'nullable|string',
            
            'items'                  => 'required|array|min:1',
            'items.*.product_id'     => 'required|exists:products,id',
            'items.*.quantity'       => 'required|numeric|min:0.01',
            'items.*.unit_price_ht'  => 'required|numeric|min:0',
            'items.*.tax_rate'       => 'required|numeric|min:0|max:100',
        ];
    }

    public function messages(): array
    {
        return [
            'items.required' => 'Au moins un produit doit être ajouté à la commande.',
            'items.min' => 'Au moins un produit doit être ajouté à la commande.',
            'expected_delivery_date.after_or_equal' => 'La date de livraison prévue doit être postérieure ou égale à la date de commande.',
        ];
    }
}