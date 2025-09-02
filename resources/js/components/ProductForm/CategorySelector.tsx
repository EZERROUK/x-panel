import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Category {
    id: number;
    name: string;
    slug: string;
    parent_id: number | null;
    level: number;
    indented_name: string;
    full_name: string;
    has_children: boolean;
    attributes?: CategoryAttribute[];
}

interface CategoryAttribute {
    id: number;
    name: string;
    slug: string;
    type: 'text' | 'textarea' | 'number' | 'decimal' | 'boolean' | 'select' | 'multiselect' | 'date' | 'url' | 'email' | 'json';
    unit?: string;
    description?: string;
    is_required: boolean;
    is_filterable: boolean;
    is_searchable: boolean;
    show_in_listing: boolean;
    is_active: boolean;
    sort_order: number;
    default_value?: string;
    validation_rules?: any;
    options?: AttributeOption[];
    current_value?: any;
}

interface AttributeOption {
    id: number;
    label: string;
    value: string;
    color?: string;
    is_active: boolean;
    sort_order: number;
}

interface CategorySelectorProps {
    categories: Category[];
    value?: number;
    onChange: (categoryId: number | null, attributes: CategoryAttribute[]) => void;
    error?: string;
    disabled?: boolean;
}

export default function CategorySelector({
    categories,
    value,
    onChange,
    error,
    disabled = false
}: CategorySelectorProps) {
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
    const [loading, setLoading] = useState(false);

    // Trouver la catégorie sélectionnée
    useEffect(() => {
        if (value) {
            const category = categories.find(c => c.id === value);
            setSelectedCategory(category || null);

            if (category && !category.has_children) {
                fetchCategoryAttributes(category.id);
            } else {
                setAttributes([]);
                onChange(value, []);
            }
        } else {
            setSelectedCategory(null);
            setAttributes([]);
        }
    }, [value, categories]);

    const fetchCategoryAttributes = async (categoryId: number) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/categories/${categoryId}/attributes`);
            if (response.ok) {
                const data = await response.json();
                setAttributes(data.attributes || []);
                onChange(categoryId, data.attributes || []);
            } else {
                console.error('Erreur lors du chargement des attributs');
                setAttributes([]);
                onChange(categoryId, []);
            }
        } catch (error) {
            console.error('Erreur lors du chargement des attributs:', error);
            setAttributes([]);
            onChange(categoryId, []);
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryChange = (categoryId: string) => {
        const id = parseInt(categoryId);
        const category = categories.find(c => c.id === id);

        if (!category) {
            setSelectedCategory(null);
            setAttributes([]);
            onChange(null, []);
            return;
        }

        setSelectedCategory(category);

        if (category.has_children) {
            // Catégorie parent - pas d'attributs
            setAttributes([]);
            onChange(id, []);
        } else {
            // Catégorie finale - charger les attributs
            fetchCategoryAttributes(id);
        }
    };

    const renderBreadcrumb = () => {
        if (!selectedCategory) return null;

        const breadcrumb = selectedCategory.full_name.split(' > ');

        return (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                {breadcrumb.map((item, index) => (
                    <React.Fragment key={index}>
                        {index > 0 && <ChevronRight className="h-3 w-3" />}
                        <span className={index === breadcrumb.length - 1 ? 'text-foreground font-medium' : ''}>
                            {item}
                        </span>
                    </React.Fragment>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="category_id">
                    Catégorie <span className="text-destructive">*</span>
                </Label>
                <Select
                    value={value?.toString() || ''}
                    onValueChange={handleCategoryChange}
                    disabled={disabled}
                >
                    <SelectTrigger className={error ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Sélectionner une catégorie..." />
                    </SelectTrigger>
                    <SelectContent>
                        {categories.map((category) => (
                            <SelectItem
                                key={category.id}
                                value={category.id.toString()}
                                className={category.level > 0 ? `pl-${category.level * 4}` : ''}
                            >
                                <span className={category.has_children ? 'font-medium' : ''}>
                                    {category.indented_name}
                                </span>
                                {category.has_children && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                        (contient des sous-catégories)
                                    </span>
                                )}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}
                {renderBreadcrumb()}
            </div>

            {/* AC1 - Message pour catégorie non finale */}
            {selectedCategory && selectedCategory.has_children && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Cette catégorie contient des sous-catégories.
                        Veuillez sélectionner une catégorie finale pour définir les attributs du produit.
                    </AlertDescription>
                </Alert>
            )}

            {/* AC2 - Affichage des attributs pour catégorie finale */}
            {selectedCategory && !selectedCategory.has_children && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium">Attributs spécialisés</h3>
                        {loading && (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        )}
                    </div>

                    {attributes.length === 0 && !loading && (
                        <p className="text-sm text-muted-foreground">
                            Aucun attribut défini pour cette catégorie.
                        </p>
                    )}

                    {attributes.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                            {attributes.length} attribut{attributes.length > 1 ? 's' : ''} trouvé{attributes.length > 1 ? 's' : ''}.
                            Les champs apparaîtront dans l'onglet "Attributs".
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
