<?php

namespace App\Domain\Promotions\DTO;

class AppliedPromotion
{
    public function __construct(
        public int $promotionId,
        public ?int $promotionCodeId,
        public string $name,
        public float $amount,
        public array $linesBreakdown = [], // [['productId'=>..,'amount'=>..], ...]
    ) { }
}
