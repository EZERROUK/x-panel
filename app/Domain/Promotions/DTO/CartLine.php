<?php

namespace App\Domain\Promotions\DTO;

class CartLine
{
    public function __construct(
        public string $sku,
        public int|string $productId,
        public ?int $categoryId,
        public int $quantity,
        public float $unitPrice
    ) {}
}
