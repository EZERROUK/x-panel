import React from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Category, CategoryAttribute } from '@/types'

interface Props {
  category: Category
  values: Record<string, any>
  onChange: (attributeSlug: string, value: any) => void
  errors: Record<string, string>
}

export default function CategoryAttributes({ category, values, onChange, errors }: Props) {
  if (!category.attributes || category.attributes.length === 0) {
    return null
  }

  const renderAttributeField = (attribute: CategoryAttribute) => {
    const value = values[attribute.slug] ?? getDefaultValue(attribute)
    const error = errors[attribute.slug]
    const isRequired = attribute.is_required

    const commonClasses = `bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 ${
      error ? 'border-red-500' : ''
    }`

    switch (attribute.type) {
      case 'text':
      case 'email':
      case 'url':
        return (
          <div key={attribute.slug}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {attribute.name}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
              {attribute.unit && <span className="text-slate-500 ml-1">({attribute.unit})</span>}
            </label>
            <Input
              type={attribute.type === 'email' ? 'email' : attribute.type === 'url' ? 'url' : 'text'}
              value={value || ''}
              onChange={(e) => onChange(attribute.slug, e.target.value)}
              placeholder={attribute.description || `Saisir ${attribute.name.toLowerCase()}`}
              className={commonClasses}
              required={isRequired}
            />
            {attribute.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{attribute.description}</p>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        )

      case 'number':
      case 'decimal':
        return (
          <div key={attribute.slug}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {attribute.name}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
              {attribute.unit && <span className="text-slate-500 ml-1">({attribute.unit})</span>}
            </label>
            <Input
              type="number"
              step={attribute.type === 'decimal' ? '0.01' : '1'}
              value={value || ''}
              onChange={(e) => onChange(attribute.slug, e.target.value)}
              placeholder={attribute.description || `Saisir ${attribute.name.toLowerCase()}`}
              className={commonClasses}
              required={isRequired}
            />
            {attribute.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{attribute.description}</p>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        )

      case 'boolean':
        return (
          <div key={attribute.slug} className="flex items-start space-x-3">
            <Checkbox
              id={attribute.slug}
              checked={!!value}
              onCheckedChange={(checked) => onChange(attribute.slug, checked)}
              className="mt-1"
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor={attribute.slug}
                className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {attribute.name}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </label>
              {attribute.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{attribute.description}</p>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          </div>
        )

      case 'select':
        return (
          <div key={attribute.slug}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {attribute.name}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
              {attribute.unit && <span className="text-slate-500 ml-1">({attribute.unit})</span>}
            </label>
            <Select
              value={value || ''}
              onValueChange={(selectedValue) => onChange(attribute.slug, selectedValue)}
            >
              <SelectTrigger className={commonClasses}>
                <SelectValue placeholder={`Sélectionner ${attribute.name.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {!isRequired && <SelectItem value="">-- Aucun --</SelectItem>}
                {attribute.options && Array.isArray(attribute.options) && attribute.options.map((option: any, index: number) => (
                  <SelectItem key={`${attribute.slug}-${index}`} value={String(option)}>
                    {String(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {attribute.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{attribute.description}</p>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        )

      case 'multiselect':
        return (
          <div key={attribute.slug}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {attribute.name}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
              {attribute.unit && <span className="text-slate-500 ml-1">({attribute.unit})</span>}
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-300 dark:border-slate-600 rounded-md p-3">
              {attribute.options && Array.isArray(attribute.options) && attribute.options.map((option: any, index: number) => {
                const isChecked = Array.isArray(value) && value.includes(String(option))
                return (
                  <div key={`${attribute.slug}-${index}`} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${attribute.slug}-${index}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const currentValues = Array.isArray(value) ? value : []
                        const optionStr = String(option)
                        if (checked) {
                          if (!currentValues.includes(optionStr)) {
                            onChange(attribute.slug, [...currentValues, optionStr])
                          }
                        } else {
                          onChange(attribute.slug, currentValues.filter(v => v !== optionStr))
                        }
                      }}
                    />
                    <label
                      htmlFor={`${attribute.slug}-${index}`}
                      className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      {String(option)}
                    </label>
                  </div>
                )
              })}
            </div>
            {attribute.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{attribute.description}</p>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        )

      case 'date':
        return (
          <div key={attribute.slug}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {attribute.name}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <Input
              type="date"
              value={value || ''}
              onChange={(e) => onChange(attribute.slug, e.target.value)}
              className={commonClasses}
              required={isRequired}
            />
            {attribute.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{attribute.description}</p>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        )

      case 'textarea':
        return (
          <div key={attribute.slug}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {attribute.name}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <Textarea
              value={value || ''}
              onChange={(e) => onChange(attribute.slug, e.target.value)}
              placeholder={attribute.description || `Saisir ${attribute.name.toLowerCase()}`}
              className={commonClasses}
              rows={3}
              required={isRequired}
            />
            {attribute.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{attribute.description}</p>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        )

      case 'json':
        return (
          <div key={attribute.slug}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {attribute.name}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <Textarea
              value={typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  onChange(attribute.slug, parsed)
                } catch {
                  // Si ce n'est pas du JSON valide, on stocke la chaîne
                  onChange(attribute.slug, e.target.value)
                }
              }}
              placeholder={attribute.description || '{"key": "value"}'}
              className={`${commonClasses} font-mono text-sm`}
              rows={4}
              required={isRequired}
            />
            {attribute.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{attribute.description}</p>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        )

      default:
        return (
          <div key={attribute.slug}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {attribute.name}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <Input
              value={value || ''}
              onChange={(e) => onChange(attribute.slug, e.target.value)}
              placeholder={attribute.description || `Saisir ${attribute.name.toLowerCase()}`}
              className={commonClasses}
              required={isRequired}
            />
            {attribute.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{attribute.description}</p>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        )
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {category.attributes.map(renderAttributeField)}
    </div>
  )
}

function getDefaultValue(attribute: CategoryAttribute): any {
  switch (attribute.type) {
    case 'boolean':
      return false
    case 'number':
    case 'decimal':
      return ''
    case 'multiselect':
      return []
    case 'json':
      return {}
    default:
      return ''
  }
}
