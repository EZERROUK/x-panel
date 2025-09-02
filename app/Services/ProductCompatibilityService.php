<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\DB;

class ProductCompatibilityService
{
    /**
     * Crée/restore un lien A→B. Si $direction === 'bidirectional',
     * crée/restore aussi B→A (toujours en 'bidirectional').
     */
    public function link(Product $a, Product $b, string $direction = 'bidirectional', ?string $note = null): void
    {
        if ($a->id === $b->id) return;

        DB::transaction(function () use ($a, $b, $direction, $note) {
            $this->upsertOne($a->id, $b->id, $direction, $note);

            if ($direction === 'bidirectional') {
                $this->upsertOne($b->id, $a->id, 'bidirectional', $note);
            } else {
                // Si lien UNI : on s'assure que l'inverse est soft-deleted
                DB::table('product_compatibilities')
                    ->where('product_id', $b->id)
                    ->where('compatible_with_id', $a->id)
                    ->whereNull('deleted_at')
                    ->update(['deleted_at' => now()]);
            }
        });
    }

    /** Soft delete; si $bothSides=true, soft-delete les deux sens. */
    public function unlink(Product $a, Product $b, bool $bothSides = true): void
    {
        DB::transaction(function () use ($a, $b, $bothSides) {
            $now = now();
            DB::table('product_compatibilities')
                ->where('product_id', $a->id)
                ->where('compatible_with_id', $b->id)
                ->whereNull('deleted_at')
                ->update(['deleted_at' => $now]);

            if ($bothSides) {
                DB::table('product_compatibilities')
                    ->where('product_id', $b->id)
                    ->where('compatible_with_id', $a->id)
                    ->whereNull('deleted_at')
                    ->update(['deleted_at' => $now]);
            }
        });
    }

    /**
     * Synchronise une liste d’IDs « simples » (tous en bidirectionnel, note nulle).
     * - Ajoute/restore les manquants
     * - Soft-delete ceux retirés (des 2 côtés)
     */
    public function syncProducts(Product $product, array $otherIds): void
    {
        $otherIds = array_values(array_unique(array_filter($otherIds)));

        DB::transaction(function () use ($product, $otherIds) {
            $current = DB::table('product_compatibilities')
                ->where('product_id', $product->id)
                ->whereNull('deleted_at')
                ->pluck('compatible_with_id')
                ->all();

            $toAdd = array_diff($otherIds, $current);
            $toDel = array_diff($current, $otherIds);

            foreach ($toAdd as $id) {
                if ($other = Product::find($id)) {
                    $this->link($product, $other, 'bidirectional', null);
                }
            }
            foreach ($toDel as $id) {
                if ($other = Product::find($id)) {
                    $this->unlink($product, $other, true);
                }
            }
        });
    }

    private function upsertOne(string $fromId, string $toId, string $direction, ?string $note): void
    {
        $row = DB::table('product_compatibilities')
            ->where('product_id', $fromId)
            ->where('compatible_with_id', $toId)
            ->first();

        if ($row) {
            DB::table('product_compatibilities')
                ->where('id', $row->id)
                ->update([
                    'direction'  => $direction,
                    'note'       => $note,
                    'deleted_at' => null,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('product_compatibilities')->insert([
                'product_id'         => $fromId,
                'compatible_with_id' => $toId,
                'direction'          => $direction,
                'note'               => $note,
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);
        }
    }
}
