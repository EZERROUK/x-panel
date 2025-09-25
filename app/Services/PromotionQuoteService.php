<?php

namespace App\Services;

use App\Domain\Promotions\PromotionEngine;
use App\Models\{Promotion, PromotionRedemption, Quote};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;

class PromotionQuoteService
{
    public function __construct(private PromotionEngine $engine) {}

    /* ======================================================================
     | Devis existant (persisté)
     |======================================================================*/
    public function preview(Quote $quote, ?string $code = null, int|string|null $userId = null): array
    {
        // On délègue le calcul à l’engine
        $cart   = QuoteCartAdapter::fromQuote($quote);
        $result = $this->engine->apply($cart, $code, $userId);

        // Enrichir avec le "hint" (action_type + value) depuis promotion_actions
        $appliedRaw = $result->applied ?? [];
        $promoIds   = collect($appliedRaw)->pluck('promotionId')->unique()->filter()->values();

        $hintsMap = [];
        if ($promoIds->isNotEmpty()) {
            // Charge l’action principale de chaque promo
            $promos = Promotion::with(['actions' => function ($q) {
                $q->orderBy('id'); // la 1ère fait foi (comme le reste du code)
            }])->whereIn('id', $promoIds)->get();

            foreach ($promos as $promo) {
                $action = $promo->actions->first();
                if ($action) {
                    $type  = $action->action_type;             // 'percent' | 'fixed'
                    $value = (float) $action->value;
                    $hintsMap[$promo->id] = [
                        'type'  => $type,
                        'value' => $value,
                    ];
                }
            }
        }

        $applied = [];
        foreach ($appliedRaw as $a) {
            $pid = $a->promotionId ?? null;
            $applied[] = [
                'promotion_id'      => $pid,
                'promotion_code_id' => $a->promotionCodeId ?? null,
                'name'              => $a->name ?? '',
                'amount'            => (float) ($a->amount ?? 0),
                'lines_breakdown'   => $a->linesBreakdown ?? [],
                // ✅ hint ajouté ici
                'hint'              => $pid && isset($hintsMap[$pid]) ? $hintsMap[$pid] : null,
            ];
        }

        return [
            'discount_total'     => (float) ($result->discountTotal ?? 0),
            'applied_promotions' => $applied,
        ];
    }

    public function apply(Quote $quote, ?string $code = null, int|string|null $userId = null): Quote
    {
        return DB::transaction(function () use ($quote, $code, $userId) {
            $data = $this->preview($quote, $code, $userId);

            // Persistance : total + promos enrichies (avec hint)
            $quote->discount_total     = $data['discount_total'];
            $quote->applied_promotions = $data['applied_promotions'];
            $quote->save();

            // (Optionnel) journaliser les redemptions
            foreach ($data['applied_promotions'] as $ap) {
                PromotionRedemption::create([
                    'promotion_id'       => $ap['promotion_id'],
                    'promotion_code_id'  => $ap['promotion_code_id'] ?? null,
                    'user_id'            => $userId,
                    'quote_id'           => $quote->id,
                    'used_at'            => Carbon::now(),
                    'amount_discounted'  => (float) $ap['amount'],
                ]);
            }

            return $quote->refresh();
        });
    }

    /* ======================================================================
     | "Transient cart" (page de création de devis, pas encore sauvegardé)
     |======================================================================*/
    public function previewFromPayload(array $payload, ?string $code = null, int|string|null $userId = null): array
    {
        Log::info('=== DEBUT PREVIEW PROMOTIONS ===', [
            'payload' => $payload,
            'code'    => $code,
            'userId'  => $userId
        ]);

        $items = $this->normalizeItems($payload['items'] ?? []);
        [$sub, $tva, $ttc, $linesTTC] = $this->totalsFromItems($items);

        $now = Carbon::now();

        $query = Promotion::with(['actions', 'codes', 'products', 'categories'])
            ->where('is_active', true);

        if ($code) {
            $query->whereHas('codes', function($c) use ($code) {
                $c->where('code', mb_strtoupper($code))->where('is_active', true);
            });
        }

        $query->where(function($q) use ($now) {
            $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
        })
        ->where(function($q) use ($now) {
            $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
        });

        $promos = $query->orderBy('priority')->get();

        $applied  = [];
        $discount = 0.0;

        $globalLineDiscounts = array_fill(0, count($items), 0.0);

        foreach ($promos as $promo) {
            $action = $promo->actions->first();
            if (!$action) continue;

            $applyScope = $promo->apply_scope ?? 'order';
            $linesBreakdown = [];

            if ($promo->min_subtotal && $sub < $promo->min_subtotal) continue;

            if ($promo->min_quantity) {
                $totalQty = array_sum(array_column($items, 'quantity'));
                if ($totalQty < $promo->min_quantity) continue;
            }

            if ($applyScope === 'order') {
                $base = $ttc;
                $amount = $this->computeActionAmount($action->action_type, (float)$action->value, $base);
                if ($amount <= 0) continue;

                if ($base > 0) {
                    foreach ($linesTTC as $i => $lt) {
                        $share   = $lt / $base;
                        $lineAmt = round($amount * $share, 2);
                        if ($lineAmt <= 0) continue;

                        $globalLineDiscounts[$i] += $lineAmt;
                        $linesBreakdown[] = ['index' => $i, 'amount' => $lineAmt];
                    }
                }

                $applied[] = [
                    'promotion_id'      => $promo->id,
                    'promotion_code_id' => null,
                    'name'              => $promo->name,
                    'amount'            => round($amount, 2),
                    'lines_breakdown'   => $linesBreakdown,
                    // ✅ hint exposé pour l’UI
                    'hint'              => [
                        'type'  => $action->action_type,          // 'percent' | 'fixed'
                        'value' => (float) $action->value,
                    ],
                ];
                $discount += $amount;

                if ($promo->stop_further_processing ?? false) break;
                continue;
            }

            if ($applyScope === 'product') {
                $eligibleIds = $promo->products->pluck('id')->map(fn($v) => (string)$v)->all();
                if (count($eligibleIds) === 0) continue;

                $eligibleTotal = 0.0;
                $eligibleLines = [];

                foreach ($items as $i => $line) {
                    $productId = (string)$line['product_id'];
                    if (in_array($productId, $eligibleIds, true)) {
                        $eligibleTotal += $linesTTC[$i];
                        $eligibleLines[] = $i;
                    }
                }

                if ($eligibleTotal <= 0) continue;

                $amount = $this->computeActionAmount($action->action_type, (float)$action->value, $eligibleTotal);
                if ($amount <= 0) continue;

                foreach ($eligibleLines as $i) {
                    $lt = $linesTTC[$i];
                    if ($lt <= 0) continue;

                    $share   = $lt / $eligibleTotal;
                    $lineAmt = round($amount * $share, 2);
                    if ($lineAmt <= 0) continue;

                    $globalLineDiscounts[$i] += $lineAmt;
                    $linesBreakdown[] = ['index' => $i, 'amount' => $lineAmt];
                }

                $applied[] = [
                    'promotion_id'      => $promo->id,
                    'promotion_code_id' => null,
                    'name'              => $promo->name,
                    'amount'            => round($amount, 2),
                    'lines_breakdown'   => $linesBreakdown,
                    // ✅ hint exposé pour l’UI
                    'hint'              => [
                        'type'  => $action->action_type,
                        'value' => (float) $action->value,
                    ],
                ];
                $discount += $amount;

                if ($promo->stop_further_processing ?? false) break;
            }

            // TODO: gérer 'category' / BOGO si besoin
        }

        $discount   = round($discount, 2);
        $grandAfter = max(0, round($ttc - $discount, 2));

        return [
            'subtotal'              => round($sub, 2),
            'tax_total'             => round($tva, 2),
            'grand_total'           => round($ttc, 2),
            'discount_total'        => $discount,
            'grand_total_after'     => $grandAfter,
            'applied_promotions'    => $applied,
            'lines_total_discounts' => array_map(fn($v) => round($v, 2), $globalLineDiscounts),
        ];
    }

    public function applyFromPayload(array $payload, ?string $code = null, int|string|null $userId = null): array
    {
        // En "transient", on ne persiste rien : même résultat que preview
        return $this->previewFromPayload($payload, $code, $userId);
    }

    /* ======================================================================
     | Helpers
     |======================================================================*/
    private function computeActionAmount(string $type, float $value, float $base): float
    {
        if ($value <= 0 || $base <= 0) return 0.0;

        return match ($type) {
            'percent' => round($base * $value / 100, 2),
            'fixed'   => round(min($value, $base), 2),
            default   => 0.0,
        };
    }

    /**
     * @return array{sub:float,tva:float,ttc:float,linesTTC:float[]}
     */
    private function totalsFromItems(array $items): array
    {
        $sub = 0.0; $tva = 0.0;
        $linesTTC = [];
        foreach ($items as $it) {
            $qty = (float)($it['quantity']      ?? 0);
            $ppu = (float)($it['unit_price_ht'] ?? 0);
            $tax = (float)($it['tax_rate']      ?? 0);

            $lineHT  = $qty * $ppu;
            $lineTVA = $lineHT * ($tax / 100);
            $lineTTC = $lineHT + $lineTVA;

            $sub += $lineHT;
            $tva += $lineTVA;
            $linesTTC[] = $lineTTC;
        }
        return [$sub, $tva, $sub + $tva, $linesTTC];
    }

    private function normalizeItems(array $items): array
    {
        $out = [];
        foreach ($items as $it) {
            $out[] = [
                'product_id'    => (string)($it['product_id'] ?? ''),
                'quantity'      => (float)  ($it['quantity'] ?? 0),
                'unit_price_ht' => (float)  ($it['unit_price_ht'] ?? 0),
                'tax_rate'      => (float)  ($it['tax_rate'] ?? 0),
            ];
        }
        return $out;
    }
}
