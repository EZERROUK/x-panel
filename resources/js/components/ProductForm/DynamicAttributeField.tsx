import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface AttributeOption {
    id: number;
    label: string;
    value: string;
    color?: string;
    is_active: boolean;
    sort_order: number;
}

interface CategoryAttribute {
    id: number;
    name: string;
    slug: string;
    type: 'text' | 'textarea' | 'number' | 'decimal' | 'boolean' | 'select' | 'multiselect' | 'date' | 'url' | 'email' | 'json';
    unit?: string;
    description?: string;
    is_required: boolean;
    default_value?: string;
    validation_rules?: any;
    options?: AttributeOption[];
}

interface DynamicAttributeFieldProps {
    attribute: CategoryAttribute;
    value: any;
    onChange: (slug: string, value: any) => void;
    error?: string;
}

export default function DynamicAttributeField({
    attribute,
    value,
    onChange,
    error
}: DynamicAttributeFieldProps) {
    const { slug, type, options = [], default_value } = attribute;

    const handleChange = (newValue: any) => {
        onChange(slug, newValue);
    };

    const renderField = () => {
        switch (type) {
            case 'text':
            case 'email':
            case 'url':
                return (
                    <Input
                        id={`attr_${slug}`}
                        type={type === 'email' ? 'email' : type === 'url' ? 'url' : 'text'}
                        value={value || ''}
                        onChange={(e) => handleChange(e.target.value)}
                        placeholder={default_value || ''}
                        className={error ? 'border-destructive' : ''}
                    />
                );

            case 'textarea':
                return (
                    <Textarea
                        id={`attr_${slug}`}
                        value={value || ''}
                        onChange={(e) => handleChange(e.target.value)}
                        placeholder={default_value || ''}
                        className={error ? 'border-destructive' : ''}
                        rows={3}
                    />
                );

            case 'number':
            case 'decimal':
                return (
                    <Input
                        id={`attr_${slug}`}
                        type="number"
                        step={type === 'decimal' ? '0.01' : '1'}
                        value={value || ''}
                        onChange={(e) => handleChange(e.target.value)}
                        placeholder={default_value || ''}
                        className={error ? 'border-destructive' : ''}
                    />
                );

            case 'date':
                return (
                    <Input
                        id={`attr_${slug}`}
                        type="date"
                        value={value || ''}
                        onChange={(e) => handleChange(e.target.value)}
                        className={error ? 'border-destructive' : ''}
                    />
                );

            case 'boolean':
                return (
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id={`attr_${slug}`}
                            checked={value === true || value === '1' || value === 1}
                            onCheckedChange={(checked) => handleChange(checked)}
                        />
                        <Label htmlFor={`attr_${slug}`} className="text-sm font-normal">
                            Activé
                        </Label>
                    </div>
                );

            case 'select':
                const activeOptions = options.filter(opt => opt.is_active);
                return (
                    <Select value={value || ''} onValueChange={handleChange}>
                        <SelectTrigger className={error ? 'border-destructive' : ''}>
                            <SelectValue placeholder="Sélectionner une option..." />
                        </SelectTrigger>
                        <SelectContent>
                            {activeOptions.map((option) => (
                                <SelectItem key={option.id} value={option.value}>
                                    <div className="flex items-center gap-2">
                                        {option.color && (
                                            <div
                                                className="w-3 h-3 rounded-full border"
                                                style={{ backgroundColor: option.color }}
                                            />
                                        )}
                                        {option.label}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );

            case 'multiselect':
                const selectedValues = Array.isArray(value) ? value :
                    (typeof value === 'string' && value ? value.split(',') : []);
                const activeMultiOptions = options.filter(opt => opt.is_active);

                return (
                    <div className="space-y-2">
                        <Select onValueChange={(optionValue) => {
                            if (!selectedValues.includes(optionValue)) {
                                handleChange([...selectedValues, optionValue]);
                            }
                        }}>
                            <SelectTrigger className={error ? 'border-destructive' : ''}>
                                <SelectValue placeholder="Ajouter une option..." />
                            </SelectTrigger>
                            <SelectContent>
                                {activeMultiOptions
                                    .filter(option => !selectedValues.includes(option.value))
                                    .map((option) => (
                                    <SelectItem key={option.id} value={option.value}>
                                        <div className="flex items-center gap-2">
                                            {option.color && (
                                                <div
                                                    className="w-3 h-3 rounded-full border"
                                                    style={{ backgroundColor: option.color }}
                                                />
                                            )}
                                            {option.label}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {selectedValues.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {selectedValues.map((val) => {
                                    const option = activeMultiOptions.find(opt => opt.value === val);
                                    return (
                                        <Badge key={val} variant="secondary" className="flex items-center gap-1">
                                            {option?.color && (
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: option.color }}
                                                />
                                            )}
                                            {option?.label || val}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleChange(selectedValues.filter(v => v !== val));
                                                }}
                                                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );

            case 'json':
                return (
                    <Textarea
                        id={`attr_${slug}`}
                        value={typeof value === 'object' ? JSON.stringify(value, null, 2) : (value || '')}
                        onChange={(e) => {
                            try {
                                const parsed = JSON.parse(e.target.value);
                                handleChange(parsed);
                            } catch {
                                handleChange(e.target.value);
                            }
                        }}
                        placeholder='{"key": "value"}'
                        className={error ? 'border-destructive' : ''}
                        rows={4}
                    />
                );

            default:
                return (
                    <Input
                        id={`attr_${slug}`}
                        value={value || ''}
                        onChange={(e) => handleChange(e.target.value)}
                        placeholder={default_value || ''}
                        className={error ? 'border-destructive' : ''}
                    />
                );
        }
    };

    return renderField();
}
