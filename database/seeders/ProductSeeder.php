<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use App\Models\Product;
use App\Models\Category;
use App\Models\CategoryAttribute;
use App\Models\ProductAttributeValue;
use App\Models\User; // ← NEW

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $faker = \Faker\Factory::create();

        // Récupère des IDs d'utilisateurs existants (pour created_by)
        $userIds = User::query()->pluck('id')->all();
        if (empty($userIds)) {
            // Aucun user ? on en crée un par défaut via la factory
            $defaultUser = User::factory()->create([
                'name'  => 'Seeder Admin',
                'email' => 'admin@example.com',
            ]);
            $userIds = [$defaultUser->id];
        }

        // Taxe: premier ID disponible, sinon 1
        $taxRateId = DB::table('tax_rates')->value('id') ?? 1;

        // Catégories cibles: sous-catégories actives (feuilles)
        $categories = Category::query()
            ->where('is_active', true)
            ->whereNotNull('parent_id')
            ->get(['id', 'slug', 'name']);

        if ($categories->isEmpty()) {
            $this->command->warn('Aucune sous-catégorie active (parent_id non nul). Aucun produit généré.');
            return;
        }

        // Par défaut: 10 produits / catégorie (modifie ici si besoin)
        $defaultPerCategory = 10;
        $perCategoryOverride = [
            // 'desktops' => 20,
            // 'laptops'  => 15,
        ];

        foreach ($categories as $cat) {
            $qty = $perCategoryOverride[$cat->slug] ?? $defaultPerCategory;

            // Attributs dynamiques définis pour la catégorie
            $attributes = CategoryAttribute::where('category_id', $cat->id)->get();

            for ($i = 0; $i < $qty; $i++) {

                // ── Tolérance min sur le prix : type + valeur
                // percentage -> valeur en %, ex: 10.00 (10%)
                // amount     -> valeur fixe en devise, ex: 99.00
                $tolType  = Arr::random(['percentage', 'amount']);
                $tolValue = $tolType === 'percentage'
                    ? $faker->randomFloat(2, 5, 25)    // 5% à 25%
                    : $faker->randomFloat(2, 20, 300); // 20 à 300 (MAD, EUR… selon ta devise)

                /** @var Product $product */
                $product = Product::factory()->create([
                    'category_id'         => $cat->id,
                    'currency_code'       => 'MAD',
                    'tax_rate_id'         => $taxRateId,

                    // nouveaux champs de tolérance
                    'min_tolerance_type'  => $tolType,
                    'min_tolerance_value' => $tolValue,

                    // >>> NEW: auteur de création
                    'created_by'          => Arr::random($userIds),
                ]);

                // Valeurs d’attributs dynamiques
                foreach ($attributes as $attr) {
                    [$raw, $typed] = $this->makeAttributeValue($faker, $attr);

                    ProductAttributeValue::create(array_merge([
                        'product_id'   => $product->id,
                        'attribute_id' => $attr->id,
                        'value'        => $raw,
                    ], $typed));
                }
            }
        }

        $this->command->info('Seed produits + valeurs d’attributs dynamiques : OK');
    }

    /**
     * Génère [valeur_brute, colonnes_typées[]] selon le type de l’attribut.
     * Aligne les noms de colonnes sur ta migration :
     * value_string, value_decimal, value_integer, value_boolean, value_date, value_json
     */
    private function makeAttributeValue($faker, CategoryAttribute $attr): array
    {
        $typed = [
            'value_string'  => null,
            'value_decimal' => null,
            'value_integer' => null,
            'value_boolean' => null,
            'value_date'    => null,
            'value_json'    => null,
        ];

        $raw  = null;
        $unit = $attr->unit;

        // Options pour select/multiselect
        $opts = [];
        if (!empty($attr->options)) {
            try {
                $decoded = is_array($attr->options) ? $attr->options : json_decode($attr->options, true, 512, JSON_THROW_ON_ERROR);
                if (is_array($decoded)) {
                    $opts = array_values(array_filter($decoded, fn($v) => is_scalar($v) && $v !== ''));
                }
            } catch (\Throwable $e) {
                // options invalides: ignore
            }
        }

        switch ($attr->type) {
            case 'boolean':
                $val = (bool) random_int(0, 1);
                $raw = $val ? '1' : '0';
                $typed['value_boolean'] = $val;
                break;

            case 'number':
                $val = $faker->numberBetween(1, 5000);
                $raw = (string) $val . ($unit ? " $unit" : '');
                $typed['value_integer'] = $val;
                break;

            case 'decimal':
                $val = $faker->randomFloat(2, 1, 10000);
                $raw = (string) $val . ($unit ? " $unit" : '');
                $typed['value_decimal'] = $val;
                break;

            case 'date':
                $date = $faker->dateTimeBetween('-3 years', 'now')->format('Y-m-d');
                $raw = $date;
                $typed['value_date'] = $date;
                break;

            case 'email':
                $str = $faker->unique()->safeEmail();
                $raw = $str;
                $typed['value_string'] = Str::limit($str, 500, '');
                break;

            case 'url':
                $str = $faker->url();
                $raw = $str;
                $typed['value_string'] = Str::limit($str, 500, '');
                break;

            case 'select':
                if (!empty($opts)) {
                    $choice = Arr::random($opts);
                    $raw = (string) $choice;
                    $typed['value_string'] = Str::limit((string) $choice, 500, '');
                } else {
                    $str = $faker->randomElement([$faker->word(), $faker->colorName(), $faker->safeColorName()]);
                    $raw = $str;
                    $typed['value_string'] = Str::limit($str, 500, '');
                }
                break;

            case 'multiselect':
                if (!empty($opts)) {
                    $pick = Arr::random($opts, min(count($opts), random_int(1, min(3, max(1, count($opts))))));
                    $pick = is_array($pick) ? $pick : [$pick];
                } else {
                    $pick = [$faker->word(), $faker->colorName()];
                }
                $raw = json_encode($pick, JSON_UNESCAPED_UNICODE);
                $typed['value_string'] = Str::limit(implode(',', $pick), 500, '');
                $typed['value_json']   = json_encode($pick);
                break;

            case 'textarea':
                $text = $faker->sentence(12);
                $raw = $text;
                $typed['value_string'] = Str::limit($text, 500, '');
                break;

            case 'json':
                $obj = ['k' => $faker->word(), 'v' => $faker->numberBetween(1, 100)];
                $raw = json_encode($obj, JSON_UNESCAPED_UNICODE);
                $typed['value_json'] = json_encode($obj);
                break;

            case 'text':
            default:
                $text = $faker->randomElement([
                    $faker->word(),
                    $faker->bothify('Model-###'),
                    $faker->colorName(),
                    strtoupper($faker->bothify('REF-####')),
                ]);
                $raw = $text . ($unit ? " $unit" : '');
                $typed['value_string'] = Str::limit($text, 500, '');
                break;
        }

        return [$raw, $typed];
    }
}
