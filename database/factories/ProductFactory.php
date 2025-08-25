<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\Brand;
use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        // Brand unique requête (fallback à une factory si aucune marque en base)
        $brand = Brand::query()->inRandomOrder()->first();
        if (!$brand) {
            $brand = Brand::factory()->create();
        }

        // Catégorie active par défaut
        $categoryId = Category::query()
            ->where('is_active', true)
            ->inRandomOrder()
            ->value('id');

        if (!$categoryId) {
            // Créer une catégorie par défaut si aucune n'existe
            $category = Category::factory()->create();
            $categoryId = $category->id;
        }

        // Nom + slug
        $baseName = $this->faker->words(2, true);
        $slug = Str::slug($baseName);

        // SKU lisible basé sur la marque
        $brandPrefix = strtoupper(Str::limit(preg_replace('/[^A-Za-z]/', '', $brand->name ?? 'GEN'), 3, ''));
        $sku = $brandPrefix . '-' . $this->faker->unique()->bothify('??-#####');

        $price = $this->faker->randomFloat(2, 50, 2500);
        $compareAtPrice = $this->faker->boolean(30) ? $price + $this->faker->randomFloat(2, 10, 500) : null;

        return [
            'id' => (string) Str::uuid(),
            'brand_id' => $brand->id,
            'name' => $baseName,
            'slug' => $slug,
            'sku' => $sku,
            'description' => $this->faker->paragraph(),
            'price' => $price,
            'compare_at_price' => $compareAtPrice,
            'cost_price' => $this->faker->randomFloat(2, 20, $price * 0.8),
            'stock_quantity' => $this->faker->numberBetween(0, 150),
            'track_inventory' => $this->faker->boolean(90),
            'low_stock_threshold' => $this->faker->numberBetween(5, 20),
            'allow_backorder' => $this->faker->boolean(20),
            'weight' => $this->faker->randomFloat(2, 0.1, 25),
            'length' => $this->faker->randomFloat(2, 5, 100),
            'width' => $this->faker->randomFloat(2, 5, 100),
            'height' => $this->faker->randomFloat(2, 1, 50),
            'type' => $this->faker->randomElement(['physical', 'digital']),
            'visibility' => $this->faker->randomElement(['public', 'hidden']),
            'is_active' => $this->faker->boolean(90),
            'is_featured' => $this->faker->boolean(10),
            'currency_code' => 'MAD',
            'tax_rate_id' => 1,
            'category_id' => $categoryId,
            'available_from' => $this->faker->boolean(80) ? null : $this->faker->dateTimeBetween('-1 month', '+1 month'),
            'available_until' => $this->faker->boolean(90) ? null : $this->faker->dateTimeBetween('+1 month', '+1 year'),
        ];
    }

    /**
     * État pratique: fixer explicitement une catégorie.
     */
    public function forCategory(Category $category): self
    {
        return $this->state(fn () => ['category_id' => $category->id]);
    }

    /**
     * État pratique: produit inactif.
     */
    public function inactive(): self
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    /**
     * État pratique: produit en vedette.
     */
    public function featured(): self
    {
        return $this->state(fn () => ['is_featured' => true]);
    }

    /**
     * État pratique: produit numérique.
     */
    public function digital(): self
    {
        return $this->state(fn () => [
            'type' => 'digital',
            'weight' => null,
            'length' => null,
            'width' => null,
            'height' => null,
            'track_inventory' => false,
            'download_url' => $this->faker->url(),
            'download_limit' => $this->faker->numberBetween(1, 10),
            'download_expiry_days' => $this->faker->numberBetween(7, 365),
        ]);
    }
}
