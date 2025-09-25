<?php

namespace App\Domain\Promotions;

use App\Domain\Promotions\DTO\{Cart, Result, AppliedPromotion};
use App\Models\{Promotion, PromotionCode, Product};
use Illuminate\Support\Carbon;

class PromotionEngine
{
    /**
     * Supporte:
     * - portées: "order" et "product"
     * - actions: percent, fixed
     * MVP: on s'arrête à la première promo valide (ou stop_further_processing).
     */
    public function apply(Cart $cart, ?string $code = null, ?int $userId = null): Result
    {
        $applied = [];
        $discountTotal = 0.0;

        $promotions = Promotion::query()
            ->with(['actions', 'products', 'codes'])
            ->where('is_active', true)
            ->orderBy('priority')
            ->get();

        $now = Carbon::now();

        $promoCode = null;
        if ($code) {
            $codeUpper = mb_strtoupper(trim($code));
            $promoCode = PromotionCode::query()
                ->where('code', $codeUpper)
                ->where('is_active', true)
                ->first();

            if (!$promoCode) {
                return new Result([], 0.0); // code invalide → aucune remise
            }
            $promotions = $promotions->where('id', $promoCode->promotion_id);
        }

        foreach ($promotions as $promo) {
            // Fenêtres
            if ($promo->starts_at && $now->lt($promo->starts_at)) continue;
            if ($promo->ends_at && $now->gt($promo->ends_at)) continue;

            // Conditions globales (sur HT)
            if ($promo->min_subtotal && $cart->subtotal() < (float)$promo->min_subtotal) continue;
            if ($promo->min_quantity && $cart->quantity() < (int)$promo->min_quantity) continue;

            $action = $promo->actions->first();
            if (!$action) continue;

            $applyScope = $promo->apply_scope ?? 'order';
            $amount = 0.0;
            $linesBreakdown = [];

            if ($applyScope === 'order') {
                // base HT (Cart::subtotal()) — si tu préfères TTC, adapte ici.
                $base = $cart->subtotal();
                $amount = $this->computeActionAmount($action->action_type, (float)$action->value, $base);

                if ($action->max_discount_amount) {
                    $amount = min($amount, (float)$action->max_discount_amount);
                }

                if ($amount > 0) {
                    // Répartition proportionnelle sur lignes HT
                    $cartLines = $cart->lines;
                    $baseHt = max(0.0, array_reduce($cartLines, fn($s, $l) => $s + ($l->quantity * $l->unitPrice), 0.0));
                    if ($baseHt > 0) {
                        foreach ($cartLines as $idx => $l) {
                            $lt = $l->quantity * $l->unitPrice;
                            if ($lt <= 0) continue;
                            $share = $lt / $baseHt;
                            $lineAmt = round($amount * $share, 2);
                            if ($lineAmt > 0) $linesBreakdown[] = ['index' => $idx, 'amount' => $lineAmt];
                        }
                    }

                    $applied[] = new AppliedPromotion(
                        promotionId: $promo->id,
                        promotionCodeId: $promoCode?->id,
                        name: $promo->name,
                        amount: round($amount, 2),
                        linesBreakdown: $linesBreakdown,
                    );
                    $discountTotal += $amount;

                    // MVP: on s'arrête après la première promo valide
                    if ($promo->stop_further_processing ?? true) break;
                }

                continue;
            }

            if ($applyScope === 'product') {
                // IDs & SKUs éligibles
                $eligibleProductIds = $promo->products->pluck('id')->map(fn($v) => (string)$v)->all();
                $eligibleSkus       = $promo->products->pluck('sku')->filter()->map(fn($v)=>mb_strtoupper(trim($v)))->all();

                $cartLines = $cart->lines;
                $eligibleTotalHt = 0.0;
                $eligibleIdx = [];

                foreach ($cartLines as $idx => $l) {
                    $lineHt = $l->quantity * $l->unitPrice;
                    if ($lineHt <= 0) continue;

                    $skuUpper = mb_strtoupper((string)$l->sku);
                    $pidStr   = (string)$l->productId;

                    $okById  = in_array($pidStr, $eligibleProductIds, true);
                    $okBySku = $skuUpper && in_array($skuUpper, $eligibleSkus, true);

                    if ($okById || $okBySku) {
                        $eligibleTotalHt += $lineHt;
                        $eligibleIdx[] = $idx;
                    }
                }

                if ($eligibleTotalHt <= 0) continue;

                $amount = $this->computeActionAmount($action->action_type, (float)$action->value, $eligibleTotalHt);
                if ($action->max_discount_amount) {
                    $amount = min($amount, (float)$action->max_discount_amount);
                }

                if ($amount > 0) {
                    foreach ($eligibleIdx as $idx) {
                        $l = $cartLines[$idx];
                        $lt = $l->quantity * $l->unitPrice;
                        if ($lt <= 0) continue;
                        $share = $lt / $eligibleTotalHt;
                        $lineAmt = round($amount * $share, 2);
                        if ($lineAmt > 0) $linesBreakdown[] = ['index' => $idx, 'amount' => $lineAmt];
                    }

                    $applied[] = new AppliedPromotion(
                        promotionId: $promo->id,
                        promotionCodeId: $promoCode?->id,
                        name: $promo->name,
                        amount: round($amount, 2),
                        linesBreakdown: $linesBreakdown,
                    );
                    $discountTotal += $amount;

                    if ($promo->stop_further_processing ?? true) break;
                }
            }
        }

        return new Result($applied, round($discountTotal, 2));
    }

    private function computeActionAmount(string $type, float $value, float $base): float
    {
        if ($value <= 0 || $base <= 0) return 0.0;
        return match ($type) {
            'percent' => round($base * $value / 100, 2),
            'fixed'   => round(min($value, $base), 2),
            default   => 0.0,
        };
    }
}
