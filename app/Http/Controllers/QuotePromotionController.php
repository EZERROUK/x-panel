<?php

namespace App\Http\Controllers;

use App\Services\PromotionQuoteService;
use App\Models\Quote;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class QuotePromotionController extends Controller
{
    public function __construct(private PromotionQuoteService $promotionService) {}

    /**
     * Preview promotions pour un devis existant
     */
    public function preview(Request $request, Quote $quote): JsonResponse
    {
        $request->validate(['code' => 'nullable|string|max:191']);

        try {
            $code   = $request->input('code');
            $userId = auth()->id();

            $quote->load('items.product');
            $result = $this->promotionService->preview($quote, $code, $userId);

            Log::info('Preview promotions pour devis existant', [
                'quote_id' => $quote->id,
                'code' => $code,
                'result' => $result
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Erreur preview promotions devis', [
                'error' => $e->getMessage(),
                'quote_id' => $quote->id
            ]);

            return response()->json([
                'error' => 'Erreur lors du calcul des promotions',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Appliquer promotions à un devis existant
     */
    public function apply(Request $request, Quote $quote): JsonResponse
    {
        $request->validate(['code' => 'nullable|string|max:191']);

        try {
            $code   = $request->input('code');
            $userId = auth()->id();

            $quote->load('items.product');
            $updatedQuote = $this->promotionService->apply($quote, $code, $userId);

            Log::info('Application promotions devis', [
                'quote_id' => $quote->id,
                'code' => $code,
                'discount_total' => $updatedQuote->discount_total
            ]);

            return response()->json([
                'quote_id' => $updatedQuote->id,
                'discount_total' => (float) $updatedQuote->discount_total,
                'applied_promotions' => $updatedQuote->applied_promotions ?? [],
                'subtotal_ht' => (float) $updatedQuote->subtotal_ht,
                'total_tax' => (float) $updatedQuote->total_tax,
                'total_ttc' => (float) $updatedQuote->total_ttc,
            ]);

        } catch (\Exception $e) {
            Log::error('Erreur application promotions devis', [
                'error' => $e->getMessage(),
                'quote_id' => $quote->id
            ]);

            return response()->json([
                'error' => 'Erreur lors de l\'application des promotions'
            ], 500);
        }
    }

    /**
     * Preview promotions pour la création de devis (payload transient)
     */
    public function previewTransient(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => 'nullable|string|max:191',
            'items' => 'required|array',
            'items.*.product_id' => 'required|string',
            'items.*.quantity' => 'required|numeric|min:0',
            'items.*.unit_price_ht' => 'required|numeric|min:0',
            'items.*.tax_rate' => 'required|numeric|min:0',
        ]);

        try {
            $code   = $data['code'] ?? null;
            $userId = auth()->id();

            Log::info('=== PREVIEW TRANSIENT PROMOTIONS ===', [
                'payload' => $data,
                'code' => $code,
                'user_id' => $userId
            ]);

            $result = $this->promotionService->previewFromPayload($data, $code, $userId);

            Log::info('Résultat preview transient', [
                'result' => $result,
                'promotions_count' => count($result['applied_promotions'] ?? [])
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Erreur preview transient promotions', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Erreur lors du calcul des promotions',
                'message' => $e->getMessage(),
                'subtotal' => 0,
                'tax_total' => 0,
                'grand_total' => 0,
                'discount_total' => 0,
                'grand_total_after' => 0,
                'applied_promotions' => [],
                'lines_total_discounts' => []
            ], 200); // 200 pour éviter que le front plante
        }
    }

    /**
     * Appliquer promotions pour payload transient (même logique que preview en création)
     */
    public function applyTransient(Request $request): JsonResponse
    {
        // En mode "transient", apply = preview (on ne persiste rien)
        return $this->previewTransient($request);
    }
}
