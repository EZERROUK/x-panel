<?php

namespace App\Services;

use App\Domain\Promotions\DTO\{Cart, CartLine};
use App\Models\Quote;

/**
 * Adapte un Quote vers un Cart pour le moteur de promos.
 * Base de calcul: HT.
 */
class QuoteCartAdapter
{
    public static function fromQuote(Quote $quote): Cart
    {
        $lines = [];

        // ⚠️ Assure-toi que $quote->load('items') a été fait avant, sinon charges ici.
        foreach ($quote->items as $item) {
            // snapshot ou fallback
            $sku       = (string)($item->product_sku_snapshot ?? $item->product_id ?? 'UNKNOWN');
            $unitPrice = (float) ($item->unit_price_ht_snapshot ?? 0);
            $qty       = (int) round((float) ($item->quantity ?? 0));

            // Essayer de fournir un productId entier si possible, sinon 0
            $pidRaw = $item->product_id;
            $pid    = is_numeric($pidRaw) ? (int)$pidRaw : 0;

            $lines[] = new CartLine(
                sku: $sku,
                productId: $pid,     // si non num, restera 0 → matching par SKU côté engine
                categoryId: null,
                quantity: $qty,
                unitPrice: $unitPrice
            );
        }

        return new Cart($lines);
    }
}
