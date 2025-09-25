<?php

namespace App\Domain\Promotions\DTO;

class Cart
{
    /** @var CartLine[] */
    public array $lines;

    public function __construct(array $lines = [])
    {
        $this->lines = $lines;
    }

    public function subtotal(): float
    {
        return array_reduce(
            $this->lines,
            fn($sum, CartLine $line) => $sum + ($line->quantity * $line->unitPrice),
            0.0
        );
    }

    public function quantity(): int
    {
        return array_reduce(
            $this->lines,
            fn($sum, CartLine $line) => $sum + $line->quantity,
            0
        );
    }
}
