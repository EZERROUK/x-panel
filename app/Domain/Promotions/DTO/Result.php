<?php

namespace App\Domain\Promotions\DTO;

class Result
{
    /** @var AppliedPromotion[] */
    public array $applied = [];
    public float $discountTotal = 0.0;

    public function __construct(array $applied = [], float $discountTotal = 0.0)
    {
        $this->applied = $applied;
        $this->discountTotal = $discountTotal;
    }
}
