<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\{Category, CategoryAttribute, AttributeOption};
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        // 👇 Auteur par défaut des catégories seedées
        $createdById = DB::table('users')->min('id'); // null si aucun user en base

        $rootCategories = [
            [
                'name' => 'Informatique',
                'slug' => 'informatique',
                'description' => 'Matériel et composants informatiques',
                // valeurs par défaut recommandées
                'type' => 'default',
                'visibility' => 'public',
                'children' => [
                    [
                        'name' => 'Processeurs',
                        'slug' => 'processeurs',
                        'type' => 'default',
                        'visibility' => 'public',
                        'attributes' => [
                            ['name' => 'Marque', 'type' => 'select', 'options' => ['Intel', 'AMD']],
                            ['name' => 'Fréquence', 'type' => 'decimal', 'unit' => 'GHz'],
                            ['name' => 'Nombre de cœurs', 'type' => 'number'],
                            ['name' => 'Socket', 'type' => 'select', 'options' => ['LGA1700', 'AM4', 'AM5']],
                        ]
                    ],
                    [
                        'name' => 'Mémoire RAM',
                        'slug' => 'memoire-ram',
                        'type' => 'default',
                        'visibility' => 'public',
                        'attributes' => [
                            ['name' => 'Capacité', 'type' => 'select', 'unit' => 'GB', 'options' => ['4', '8', '16', '32', '64']],
                            ['name' => 'Type', 'type' => 'select', 'options' => ['DDR4', 'DDR5']],
                            ['name' => 'Fréquence', 'type' => 'number', 'unit' => 'MHz'],
                        ]
                    ],
                    [
                        'name' => 'Cartes graphiques',
                        'slug' => 'cartes-graphiques',
                        'type' => 'default',
                        'visibility' => 'public',
                        'attributes' => [
                            ['name' => 'Marque', 'type' => 'select', 'options' => ['NVIDIA', 'AMD']],
                            ['name' => 'Mémoire VRAM', 'type' => 'select', 'unit' => 'GB', 'options' => ['4', '6', '8', '12', '16', '24']],
                            ['name' => 'Interface', 'type' => 'select', 'options' => ['PCIe 4.0', 'PCIe 3.0']],
                        ]
                    ],
                ]
            ],
            [
                'name' => 'Électronique',
                'slug' => 'electronique',
                'description' => 'Appareils électroniques grand public',
                'type' => 'default',
                'visibility' => 'public',
                'children' => [
                    [
                        'name' => 'Smartphones',
                        'slug' => 'smartphones',
                        'type' => 'default',
                        'visibility' => 'public',
                        'attributes' => [
                            ['name' => 'Marque', 'type' => 'select', 'options' => ['Apple', 'Samsung', 'Google', 'OnePlus']],
                            ['name' => 'Taille écran', 'type' => 'decimal', 'unit' => 'pouces'],
                            ['name' => 'Stockage', 'type' => 'select', 'unit' => 'GB', 'options' => ['64', '128', '256', '512', '1024']],
                            ['name' => 'Couleur', 'type' => 'select', 'options' => ['Noir', 'Blanc', 'Bleu', 'Rouge', 'Vert']],
                            ['name' => '5G', 'type' => 'boolean'],
                        ]
                    ],
                    [
                        'name' => 'Ordinateurs portables',
                        'slug' => 'ordinateurs-portables',
                        'type' => 'default',
                        'visibility' => 'public',
                        'attributes' => [
                            ['name' => 'Processeur', 'type' => 'text'],
                            ['name' => 'RAM', 'type' => 'select', 'unit' => 'GB', 'options' => ['8', '16', '32', '64']],
                            ['name' => 'Stockage', 'type' => 'select', 'unit' => 'GB', 'options' => ['256', '512', '1024', '2048']],
                            ['name' => 'Taille écran', 'type' => 'select', 'unit' => 'pouces', 'options' => ['13', '14', '15', '16', '17']],
                        ]
                    ],
                ]
            ],
            [
                'name' => 'Mode & Accessoires',
                'slug' => 'mode-accessoires',
                'description' => 'Vêtements et accessoires',
                'type' => 'default',
                'visibility' => 'public',
                'children' => [
                    [
                        'name' => 'Vêtements',
                        'slug' => 'vetements',
                        'type' => 'default',
                        'visibility' => 'public',
                        'attributes' => [
                            ['name' => 'Taille', 'type' => 'select', 'options' => ['XS', 'S', 'M', 'L', 'XL', 'XXL']],
                            ['name' => 'Couleur', 'type' => 'multiselect', 'options' => ['Noir', 'Blanc', 'Rouge', 'Bleu', 'Vert', 'Jaune']],
                            ['name' => 'Matière', 'type' => 'select', 'options' => ['Coton', 'Polyester', 'Laine', 'Soie']],
                            ['name' => 'Lavable en machine', 'type' => 'boolean'],
                        ]
                    ],
                ]
            ],
        ];

        DB::transaction(function () use ($rootCategories, $createdById) {
            foreach ($rootCategories as $rootData) {
                // Racine
                $root = Category::firstOrCreate(
                    ['slug' => $rootData['slug'], 'parent_id' => null],
                    [
                        'name'        => $rootData['name'],
                        'description' => $rootData['description'] ?? null,
                        'is_active'   => true,
                        'sort_order'  => 0,
                        'type'        => $rootData['type'] ?? 'default',
                        'visibility'  => $rootData['visibility'] ?? 'public',
                        'created_by'  => $createdById, // ✅ auteur
                    ]
                );
                // Backfill si déjà existant et pas d'auteur
                if (is_null($root->created_by) && $createdById) {
                    $root->forceFill(['created_by' => $createdById])->saveQuietly();
                }

                foreach ($rootData['children'] ?? [] as $childData) {
                    // Enfant
                    $child = Category::firstOrCreate(
                        ['slug' => $childData['slug'], 'parent_id' => $root->id],
                        [
                            'name'        => $childData['name'],
                            'is_active'   => true,
                            'sort_order'  => 0,
                            'type'        => $childData['type'] ?? 'default',
                            'visibility'  => $childData['visibility'] ?? 'public',
                            'created_by'  => $createdById, // ✅ auteur
                        ]
                    );
                    if (is_null($child->created_by) && $createdById) {
                        $child->forceFill(['created_by' => $createdById])->saveQuietly();
                    }

                    // Attributs de l’enfant
                    foreach ($childData['attributes'] ?? [] as $index => $attrData) {
                        $attrSlug = Str::slug($attrData['name']);

                        $attribute = CategoryAttribute::updateOrCreate(
                            ['category_id' => $child->id, 'slug' => $attrSlug],
                            [
                                'name'            => $attrData['name'],
                                'type'            => $attrData['type'],
                                'unit'            => $attrData['unit'] ?? null,
                                'is_required'     => (bool)($attrData['required'] ?? false),
                                'is_filterable'   => true,
                                'is_searchable'   => in_array($attrData['type'], ['text', 'select']),
                                'show_in_listing' => $index < 2,
                                'sort_order'      => $index,
                                'is_active'       => true,
                            ]
                        );

                        if (in_array($attrData['type'], ['select', 'multiselect']) && !empty($attrData['options'])) {
                            foreach ($attrData['options'] as $optIndex => $optionLabel) {
                                AttributeOption::updateOrCreate(
                                    [
                                        'attribute_id' => $attribute->id,
                                        'value'        => Str::slug($optionLabel),
                                    ],
                                    [
                                        'label'      => $optionLabel,
                                        'sort_order' => $optIndex,
                                        'is_active'  => true,
                                    ]
                                );
                            }
                        }
                    }
                }
            }
        });
    }
}
