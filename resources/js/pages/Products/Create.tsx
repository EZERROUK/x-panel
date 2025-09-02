import React, { useEffect, useMemo, useState, useRef } from 'react'
import { Head, useForm } from '@inertiajs/react'
import { route } from 'ziggy-js'
import { UploadCloud, X, ArrowLeft, Plus, AlertCircle, Calendar } from 'lucide-react'
import { motion } from 'framer-motion'
import axios from 'axios'

import AppLayout from '@/layouts/app-layout'
import ParticlesBackground from '@/components/ParticlesBackground'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs'

import type { PageProps, Category, Currency, TaxRate } from '@/types'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type SpecializedData = Record<string, any>

type CompatibilityEntry = {
  compatible_with_id: string
  direction?: 'bidirectional' | 'uni'
  note?: string
}

type ProductType = 'physical' | 'digital' | 'service'
type ProductVisibility = 'public' | 'hidden' | 'draft'
type ToleranceTypeUI = 'percentage' | 'amount'

interface ProductFormData {
  brand_id: string
  name: string
  model: string
  sku: string
  description: string

  // SEO
  meta_title: string
  meta_description: string
  meta_keywords: string

  // Pricing
  price: string
  compare_at_price: string
  cost_price: string
  // Tolerance
  min_tolerance_type: '' | ToleranceTypeUI
  min_tolerance_value: string

  // Relations
  currency_code: string
  tax_rate_id: number
  category_id: number | ''

  // E-commerce
  type: ProductType
  visibility: ProductVisibility
  available_from: string
  available_until: string

  // Inventory
  stock_quantity: number
  track_inventory: boolean
  low_stock_threshold: number | ''
  allow_backorder: boolean

  // Physical attributes
  weight: string
  length: string
  width: string
  height: string

  // Digital
  download_url: string
  download_limit: string
  download_expiry_days: string

  // Flags
  is_active: boolean
  is_featured: boolean
  has_variants: boolean

  // Media
  images: File[]
  primary_image_index: number

  // Dynamic attributes
  spec: SpecializedData
  attributes?: Record<string, any>

  // Compat
  compatibilities: CompatibilityEntry[]
}

interface AttributeOptionDTO {
  id: number
  label: string
  value: string
  color?: string | null
  sort_order?: number
  is_active?: boolean
}

type AttrType =
  | 'text' | 'textarea' | 'number' | 'decimal' | 'boolean'
  | 'select' | 'multiselect' | 'date' | 'url' | 'email' | 'json'

interface CategoryAttributeDTO {
  id: number
  name: string
  slug: string
  type: AttrType
  unit?: string | null
  description?: string | null
  is_required: boolean
  default_value?: any
  validation_rules?: any
  options?: AttributeOptionDTO[]
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */
export default function CreateProduct({
  brands, categories, currencies, taxRates,
}: PageProps<{
  brands: { id: number; name: string }[]
  categories: Category[]
  currencies: Currency[]
  taxRates: TaxRate[]
}>) {
  const form = useForm<ProductFormData>({
    brand_id: '',
    name: '',
    model: '',
    sku: '',
    description: '',

    // SEO
    meta_title: '',
    meta_description: '',
    meta_keywords: '',

    // Pricing
    price: '',
    compare_at_price: '',
    cost_price: '',
    min_tolerance_type: '',
    min_tolerance_value: '',

    // Relations
    currency_code: currencies[0]?.code ?? '',
    tax_rate_id: taxRates[0]?.id ?? 0,
    category_id: '',

    // E-commerce
    type: 'physical',
    visibility: 'public',
    available_from: '',
    available_until: '',

    // Inventory
    stock_quantity: 0,
    track_inventory: true,
    low_stock_threshold: 5,
    allow_backorder: false,

    // Physical
    weight: '',
    length: '',
    width: '',
    height: '',

    // Digital
    download_url: '',
    download_limit: '',
    download_expiry_days: '',

    // Flags
    is_active: true,
    is_featured: false,
    has_variants: false,

    // Media
    images: [],
    primary_image_index: 0,

    // Dynamic
    spec: {},
    compatibilities: [],
  })

  const { data, setData, post, processing, errors } = form

  /* ---------- Prévisualisation images ---------- */
  const [previews, setPreviews] = useState<string[]>([])
  useEffect(() => {
    const urls = data.images.map(f => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [data.images])

  /* ---------- Produits pour compatibilité (avec catégorie sélectionnée) ---------- */
  const [allProducts, setAllProducts] = useState<{ id:string; name:string }[]>([])

  // Recharger les produits compatibles quand la catégorie change
  useEffect(() => {
    const categoryId = data.category_id
    if (!categoryId) {
      setAllProducts([])
      return
    }

    const url = route('api.products.compatible-list', { category_id: categoryId })

    axios.get(url)
      .then(res => setAllProducts(res.data))
      .catch(err => {
        console.error('compatible-list failed', err)
        setAllProducts([])
      })
  }, [data.category_id])

  /* ---------- Attributs dynamiques par catégorie ---------- */
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttributeDTO[]>([])
  const [attrLoading, setAttrLoading] = useState(false)
  const [attrError, setAttrError] = useState<string | null>(null)

  const currentCategory = useMemo(
    () => categories.find(c => c.id === data.category_id),
    [categories, data.category_id]
  )

  const parentCategory = useMemo(
    () => currentCategory?.parent_id ? categories.find(c => c.id === currentCategory.parent_id) : null,
    [categories, currentCategory]
  )

  // charge les attributs au changement de catégorie
  useEffect(() => {
    const catId = data.category_id
    if (!catId) {
      setCategoryAttributes([])
      setData('spec', {})
      setAttrError(null)
      return
    }

    let cancelled = false
    setAttrLoading(true)
    setAttrError(null)

    const url = `/api/categories/${catId}/attributes`
    axios.get(url)
      .then(res => {
        if (cancelled) return
        const attrs: CategoryAttributeDTO[] = res.data?.attributes ?? []

        setCategoryAttributes(attrs)

        // initialise spec avec valeurs par défaut selon type
        const nextSpec: Record<string, any> = {}
        attrs.forEach(a => {
          switch (a.type) {
            case 'boolean':
              nextSpec[a.slug] = a.default_value ?? false
              break
            case 'number':
            case 'decimal':
            case 'text':
            case 'url':
            case 'email':
            case 'date':
            case 'textarea':
            case 'select':
              nextSpec[a.slug] = a.default_value ?? ''
              break
            case 'multiselect':
              nextSpec[a.slug] = Array.isArray(a.default_value) ? a.default_value : []
              break
            case 'json':
              nextSpec[a.slug] =
                typeof a.default_value === 'object' && a.default_value !== null
                  ? a.default_value
                  : (a.default_value ? safeJsonParse(String(a.default_value), {}) : {})
              break
            default:
              nextSpec[a.slug] = a.default_value ?? ''
          }
        })
        setData('spec', nextSpec)
      })
      .catch(() => {
        if (cancelled) return
        setCategoryAttributes([])
        setAttrError('Impossible de charger les attributs de cette catégorie.')
      })
      .finally(() => {
        if (!cancelled) setAttrLoading(false)
      })

    return () => { cancelled = true }
  }, [data.category_id])

  /* ---------- Helpers calculs tarification ---------- */
  const currency = useMemo(
    () => currencies.find(c => c.code === data.currency_code),
    [currencies, data.currency_code]
  )
  const currencySymbol = currency?.symbol ?? ''

  const vatRate = useMemo(() => {
    const tr = taxRates.find(t => t.id === Number(data.tax_rate_id));
    const n  = Number(tr?.rate ?? 0);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [taxRates, data.tax_rate_id]);

  const priceNum = useMemo(() => toFloat(data.price), [data.price])
  const costNum  = useMemo(() => toFloat(data.cost_price), [data.cost_price])

  const priceTTC = useMemo(() => {
    if (priceNum <= 0) return 0
    return round2(priceNum * (1 + vatRate / 100))
  }, [priceNum, vatRate])

  const marginAbs = useMemo(() => {
    if (priceNum <= 0) return 0
    return round2(priceNum - costNum)
  }, [priceNum, costNum])

  const marginPct = useMemo(() => {
    if (priceNum <= 0) return 0
    return round1(((priceNum - costNum) / priceNum) * 100)
  }, [priceNum, costNum])

  const minAllowedPrice = useMemo(() => computeMinAllowedPrice(priceNum, data.min_tolerance_type, data.min_tolerance_value), [priceNum, data.min_tolerance_type, data.min_tolerance_value])

  /* ---------- Handlers ---------- */
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files).slice(0, 7)
    setData('images', files)
    setData('primary_image_index', 0)
  }

  const removeImage = (idx:number) => {
    const imgs = data.images.filter((_, i) => i !== idx)
    setData('images', imgs)
    setData('primary_image_index', Math.min(data.primary_image_index, Math.max(0, imgs.length - 1)))
  }

  const choosePrimary = (idx:number) => setData('primary_image_index', idx)

  const setSpecField = (field:string, value:any) =>
    setData('spec', { ...(data.spec ?? {}), [field]: value })

  const setCompatibilities = (list:CompatibilityEntry[]) =>
    setData('compatibilities', list)

  // --- Compat: états & helpers pour la liste déroulante ---
  const compatIds = useMemo(
    () => new Set((data.compatibilities ?? []).map(c => c.compatible_with_id)),
    [data.compatibilities]
  )

  const [selectedCompatId, setSelectedCompatId] = useState<string>('')

  const addSelectedCompatibility = () => {
    if (!selectedCompatId || compatIds.has(selectedCompatId)) return
    setData('compatibilities', [
      ...(data.compatibilities ?? []),
      { compatible_with_id: selectedCompatId, direction: 'bidirectional' as const, note: '' }
    ])
    setSelectedCompatId('')
  }

  const removeCompatibility = (id: string) => {
    setData('compatibilities', (data.compatibilities ?? []).filter(c => c.compatible_with_id !== id))
  }

  const updateCompatibility = (id: string, patch: Partial<CompatibilityEntry>) => {
    setData('compatibilities',
      (data.compatibilities ?? []).map(c =>
        c.compatible_with_id === id ? { ...c, ...patch } : c
      )
    )
  }

  const handleSubmit = (e:React.FormEvent) => {
    e.preventDefault()

    // Prépare 'attributes' pour le backend à partir de 'spec'
    const attrs: Record<string, any> = { ...(data.spec || {}) }
    // typage JSON (si champs json saisis en string)
    categoryAttributes.forEach(a => {
      if (a.type === 'json') {
        const v = attrs[a.slug]
        if (typeof v === 'string') {
          attrs[a.slug] = safeJsonParse(v, {})
        }
      }
    })

    form.transform((payload) => ({
      ...payload,
      attributes: attrs,
      // tolérance : mappe "none" → null et vide → null
      min_tolerance_type: data.min_tolerance_type ? data.min_tolerance_type : null,
      min_tolerance_value: data.min_tolerance_type
        ? toFloat(data.min_tolerance_value)
        : null,
    }))

    post(route('products.store'), {
      forceFormData: true,
      onFinish: () => form.transform((p) => p),
      onError: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    })
  }

  /* ---------- Refs + helper pour date/time ---------- */
  const fromRef  = useRef<HTMLInputElement>(null)
  const untilRef = useRef<HTMLInputElement>(null)

  const openPicker = (ref: React.RefObject<HTMLInputElement>) => {
    const el = ref.current as any
    if (el?.showPicker) el.showPicker()
    else el?.focus()
  }

  /* ------------------------------------------------------------------ */
  /* Rendu                                                              */
  /* ------------------------------------------------------------------ */
  return (
    <>
      <Head title="Créer un produit" />

      <div className="relative min-h-screen bg-gradient-to-br
                      from-white via-slate-100 to-slate-200
                      dark:from-[#0a0420] dark:via-[#0e0a32] dark:to-[#1B1749]
                      transition-colors duration-500">
        <ParticlesBackground />

        <AppLayout breadcrumbs={[{ title:'Produits', href:'/products' }, { title:'Créer' }]}>
          <div className="grid grid-cols-12 gap-6 p-6">

            {/* ────────── Formulaire sur toute la largeur ────────── */}
            <div className="col-span-12">
              <div className="rounded-xl border border-slate-200 bg-white shadow-xl
                              dark:bg-white/5 dark:border-slate-700 backdrop-blur-md p-6 md:p-8">
                <h1 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">
                  Nouveau produit
                </h1>

                {Object.keys(errors).length > 0 && (
                  <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800">
                    <strong>Erreur(s) dans le formulaire :</strong>
                    <ul className="list-disc list-inside mt-2 text-sm">
                      {Object.entries(errors).map(([field, message]) => (
                        <li key={field}>{String(message)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <Tabs defaultValue="general" className="w-full">
                    <TabsList className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                      <TabsTrigger value="general">Général</TabsTrigger>
                      <TabsTrigger value="pricing">Tarification</TabsTrigger>
                      <TabsTrigger value="inventory">Inventaire</TabsTrigger>
                      <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
                      <TabsTrigger value="availability">Disponibilité</TabsTrigger>
                      <TabsTrigger value="digital">Numérique</TabsTrigger>
                      <TabsTrigger value="images">Images</TabsTrigger>
                      <TabsTrigger value="compat">Compatibilités</TabsTrigger>
                      <TabsTrigger value="seo">SEO</TabsTrigger>
                    </TabsList>

                    {/* --- Général --- */}
                    <TabsContent value="general" className="pt-4 space-y-6">
                      {/* Marque & Modèle */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Marque
                          </label>
                          <Select value={data.brand_id} onValueChange={v => setData('brand_id', v)}>
                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                              <SelectValue placeholder="Sélectionner une marque" />
                            </SelectTrigger>
                            <SelectContent>
                              {brands.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Modèle
                          </label>
                          <Input
                            placeholder="Modèle du produit"
                            value={data.model}
                            onChange={e => setData('model', e.target.value)}
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Nom & SKU */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Nom <span className="text-red-500">*</span>
                          </label>
                          <Input
                            placeholder="Nom du produit"
                            required
                            value={data.name}
                            onChange={e => setData('name', e.target.value)}
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            SKU <span className="text-red-500">*</span>
                          </label>
                          <Input
                            placeholder="Code produit"
                            required
                            value={data.sku}
                            onChange={e => setData('sku', e.target.value)}
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Type & Visibilité */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Type <span className="text-red-500">*</span>
                          </label>
                          <Select
                            value={data.type}
                            onValueChange={(v) => setData('type', v as ProductType)}
                          >
                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                              <SelectValue placeholder="Type de produit" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="physical">Physique</SelectItem>
                              <SelectItem value="digital">Numérique</SelectItem>
                              <SelectItem value="service">Service</SelectItem>
                            </SelectContent>
                          </Select>
                          {(errors as any)['type'] && (
                            <p className="mt-1 text-sm text-red-600">{String((errors as any)['type'])}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Visibilité <span className="text-red-500">*</span>
                          </label>
                          <Select
                            value={data.visibility}
                            onValueChange={(v) => setData('visibility', v as ProductVisibility)}
                          >
                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                              <SelectValue placeholder="Visibilité" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="public">Publique</SelectItem>
                              <SelectItem value="hidden">Masqué</SelectItem>
                              <SelectItem value="draft">Brouillon</SelectItem>
                            </SelectContent>
                          </Select>
                          {(errors as any)['visibility'] && (
                            <p className="mt-1 text-sm text-red-600">{String((errors as any)['visibility'])}</p>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Description
                        </label>
                        <Textarea
                          placeholder="Description du produit"
                          value={data.description}
                          onChange={e => setData('description', e.target.value)}
                          className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                        />
                      </div>

                      {/* Catégorie */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Catégorie <span className="text-red-500">*</span>
                        </label>
                        <Select
                          value={data.category_id ? String(data.category_id) : ''}
                          onValueChange={(v) => setData('category_id', Number(v))}
                        >
                          <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                            <SelectValue placeholder="Sélectionner une catégorie" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(c => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {(c as any).indented_name ?? c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {(errors as any)['category_id'] && (
                          <p className="mt-1 text-sm text-red-600">{String((errors as any)['category_id'])}</p>
                        )}
                      </div>

                      {/* Attributs dynamiques */}
                      {attrLoading && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Chargement des attributs…</p>
                      )}
                      {attrError && <p className="text-sm text-red-600">{attrError}</p>}
                      {!attrLoading && !attrError && categoryAttributes.length === 0 && data.category_id && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Cette catégorie n'a pas d'attributs actifs — ou aucun n'a été défini.
                        </p>
                      )}
                      {categoryAttributes.length > 0 && (
                        <div className="space-y-4 pt-2">
                          {categoryAttributes.map(attr => {
                            const fieldId = `attr_${attr.slug}`
                            const fieldErr = (errors as any)[`attributes.${attr.slug}`] as string | undefined
                            const value = (data.spec ?? {})[attr.slug]

                            return (
                              <div key={attr.slug}>
                                <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                  {attr.name}{attr.is_required ? ' *' : ''}{attr.unit ? <span className="opacity-70"> ({attr.unit})</span> : null}
                                </label>

                                {attr.type === 'textarea' && (
                                  <Textarea
                                    id={fieldId}
                                    value={value ?? ''}
                                    onChange={e => setSpecField(attr.slug, e.target.value)}
                                    className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                                  />
                                )}

                                {(attr.type === 'text' || attr.type === 'url' || attr.type === 'email') && (
                                  <Input
                                    id={fieldId}
                                    type={attr.type === 'text' ? 'text' : attr.type}
                                    value={value ?? ''}
                                    onChange={e => setSpecField(attr.slug, e.target.value)}
                                    className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                                  />
                                )}

                                {(attr.type === 'number' || attr.type === 'decimal') && (
                                  <Input
                                    id={fieldId}
                                    type="number"
                                    step={attr.type === 'decimal' ? '0.01' : '1'}
                                    value={value ?? ''}
                                    onChange={e => setSpecField(attr.slug, e.target.value)}
                                    className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                                  />
                                )}

                                {attr.type === 'date' && (
                                  <Input
                                    id={fieldId}
                                    type="date"
                                    value={value ?? ''}
                                    onChange={e => setSpecField(attr.slug, e.target.value)}
                                    className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                                  />
                                )}

                                {attr.type === 'boolean' && (
                                  <label className="inline-flex items-center gap-2">
                                    <input
                                      id={fieldId}
                                      type="checkbox"
                                      checked={!!value}
                                      onChange={e => setSpecField(attr.slug, e.target.checked)}
                                      className="w-4 h-4 text-red-600 bg-white border-slate-300 rounded focus:ring-red-500 focus:ring-2"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">Oui / Non</span>
                                  </label>
                                )}

                                {attr.type === 'select' && (
                                  <Select
                                    value={value ?? ''}
                                    onValueChange={v => setSpecField(attr.slug, v)}
                                  >
                                    <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                                      <SelectValue placeholder="Sélectionner une option" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(attr.options ?? [])
                                        .filter(o => String(o.value) !== '') /* sécurité shadcn */
                                        .map(o => (
                                          <SelectItem key={o.id} value={o.value}>{o.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                )}

                                {attr.type === 'multiselect' && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {(attr.options ?? []).map(o => {
                                      const selected: string[] = Array.isArray(value) ? value : []
                                      const checked = selected.includes(o.value)
                                      return (
                                        <label key={o.id} className="flex items-center gap-2 p-2 rounded border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => {
                                              const set = new Set(selected)
                                              e.target.checked ? set.add(o.value) : set.delete(o.value)
                                              setSpecField(attr.slug, Array.from(set))
                                            }}
                                          />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">{o.label}</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                )}

                                {attr.type === 'json' && (
                                  <Textarea
                                    id={fieldId}
                                    value={typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2)}
                                    onChange={e => setSpecField(attr.slug, e.target.value)}
                                    className="font-mono text-xs bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                                    placeholder='{"key": "value"}'
                                    rows={4}
                                  />
                                )}

                                {attr.description && (
                                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{attr.description}</p>
                                )}
                                {fieldErr && (
                                  <p className="mt-1 text-sm text-red-600">{fieldErr}</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </TabsContent>

                    {/* --- Tarification --- */}
                    <TabsContent value="pricing" className="pt-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-1">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Prix <span className="text-red-500">*</span>
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            required
                            value={data.price}
                            onChange={e => setData('price', e.target.value)}
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                            Prix comparé
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={data.compare_at_price}
                            onChange={e => setData('compare_at_price', e.target.value)}
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                            Coût
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={data.cost_price}
                            onChange={e => setData('cost_price', e.target.value)}
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Devise
                          </label>
                          <Select value={data.currency_code} onValueChange={v => setData('currency_code', v)}>
                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                              <SelectValue placeholder="Devise" />
                            </SelectTrigger>
                            <SelectContent>
                              {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.symbol} ({c.code})</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Tolérance */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Tolérance (type)
                          </label>
                          <Select
                            value={data.min_tolerance_type || ''}
                            onValueChange={(v) => setData('min_tolerance_type', v === 'none' ? '' : (v as ToleranceTypeUI))}
                          >
                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                              <SelectValue placeholder="Aucune" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Aucune</SelectItem>
                              <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                              <SelectItem value="amount">Montant</SelectItem>
                            </SelectContent>
                          </Select>
                          {(errors as any)['min_tolerance_type'] && (
                            <p className="mt-1 text-sm text-red-600">{String((errors as any)['min_tolerance_type'])}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Tolérance (valeur)
                          </label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={data.min_tolerance_type === 'percentage' ? 'ex: 15.00' : 'ex: 50.00'}
                              value={data.min_tolerance_value}
                              onChange={e => setData('min_tolerance_value', e.target.value)}
                              disabled={!data.min_tolerance_type}
                              className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                              {data.min_tolerance_type === 'percentage' ? '%' : (currencySymbol || 'Dhs')}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Définit le prix plancher autorisé pour l'équipe.
                          </p>
                          {(errors as any)['min_tolerance_value'] && (
                            <p className="mt-1 text-sm text-red-600">{String((errors as any)['min_tolerance_value'])}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Aperçu prix minimum autorisé
                          </label>
                          <div className="h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center">
                            <span className="text-slate-700 dark:text-slate-200 text-sm">
                              {minAllowedPrice === null ? '—' : `${formatMoney(minAllowedPrice, currencySymbol)} ${currency?.code ?? ''}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* TVA + indicateurs live */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            TVA
                          </label>
                          <Select value={String(data.tax_rate_id)} onValueChange={v => setData('tax_rate_id', Number(v))}>
                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                              <SelectValue placeholder="Taux de TVA" />
                            </SelectTrigger>
                            <SelectContent>
                              {taxRates.map(t => (
                                <SelectItem key={t.id} value={String(t.id)}>
                                  {t.name} ({t.rate}%)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="p-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                          <div className="text-xs text-slate-500 dark:text-slate-400">Prix TTC estimé</div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {priceNum > 0 ? `${formatMoney(priceTTC, currencySymbol)} ${currency?.code ?? ''}` : '—'}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            TVA: {vatRate}% (appliquée sur le prix HT)
                          </div>
                        </div>

                        <div className="p-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                          <div className="text-xs text-slate-500 dark:text-slate-400">Marge estimée</div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {priceNum > 0
                              ? `${formatMoney(marginAbs, currencySymbol)} ${currency?.code ?? ''} (${marginPct}%)`
                              : '—'}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Marge = (Prix - Coût) / Prix
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* --- Inventaire --- */}
                    <TabsContent value="inventory" className="pt-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-end gap-2">
                          <div className="w-full">
                            <label htmlFor="stock_quantity" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              Stock <span className="text-red-500">*</span>
                            </label>
                            <Input
                              id="stock_quantity"
                              type="number"
                              min={0}
                              required
                              value={data.stock_quantity}
                              onChange={e => setData('stock_quantity', Number(e.target.value))}
                              className="w-full bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Seuil stock bas
                          </label>
                          <Input
                            type="number"
                            min={0}
                            value={data.low_stock_threshold ?? ''}
                            onChange={e => setData('low_stock_threshold', e.target.value === '' ? '' : Number(e.target.value))}
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div className="flex items-end gap-4">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={data.track_inventory}
                              onChange={e => setData('track_inventory', e.target.checked)}
                              className="w-4 h-4 text-red-600 bg-white border-slate-300 rounded focus:ring-red-500 focus:ring-2"
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Suivre le stock</span>
                          </label>
                        </div>
                      </div>

                      {/* Flags */}
                      <div className="flex flex-wrap gap-6">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={data.is_active}
                            onChange={e => setData('is_active', e.target.checked)}
                            className="w-4 h-4 text-red-600 bg-white border-slate-300 rounded focus:ring-red-500 focus:ring-2"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Actif</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={data.is_featured}
                            onChange={e => setData('is_featured', e.target.checked)}
                            className="w-4 h-4 text-red-600 bg-white border-slate-300 rounded focus:ring-red-500 focus:ring-2"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">En vedette</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={data.allow_backorder}
                            onChange={e => setData('allow_backorder', e.target.checked)}
                            className="w-4 h-4 text-red-600 bg-white border-slate-300 rounded focus:ring-red-500 focus:ring-2"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Précommande</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={data.has_variants}
                            onChange={e => setData('has_variants', e.target.checked)}
                            className="w-4 h-4 text-red-600 bg-white border-slate-300 rounded focus:ring-red-500 focus:ring-2"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Variantes</span>
                        </label>
                      </div>
                    </TabsContent>

                    {/* --- Dimensions --- */}
                    <TabsContent value="dimensions" className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[
                          { key:'weight', label:'Poids (kg)' },
                          { key:'length', label:'Longueur (cm)' },
                          { key:'width',  label:'Largeur (cm)' },
                          { key:'height', label:'Hauteur (cm)' },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                              {f.label}
                            </label>
                            <Input
                              type="number"
                              step="0.01"
                              value={(data as any)[f.key]}
                              onChange={e => setData(f.key as any, e.target.value)}
                              className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                            />
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    {/* --- Disponibilité --- */}
                    <TabsContent value="availability" className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* From */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Disponible à partir du
                          </label>
                          <div className="relative">
                            <Input
                              ref={fromRef}
                              type="datetime-local"
                              value={data.available_from}
                              onChange={e => setData('available_from', e.target.value)}
                              className="pr-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:pointer-events-none"
                            />
                            <button
                              type="button"
                              onClick={() => openPicker(fromRef)}
                              className="absolute inset-y-0 right-2 flex items-center px-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
                              aria-label="Ouvrir le calendrier"
                              tabIndex={-1}
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Until */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Disponible jusqu'au
                          </label>
                          <div className="relative">
                            <Input
                              ref={untilRef}
                              type="datetime-local"
                              value={data.available_until}
                              onChange={e => setData('available_until', e.target.value)}
                              className="pr-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:pointer-events-none"
                            />
                            <button
                              type="button"
                              onClick={() => openPicker(untilRef)}
                              className="absolute inset-y-0 right-2 flex items-center px-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
                              aria-label="Ouvrir le calendrier"
                              tabIndex={-1}
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* --- Numérique --- */}
                    <TabsContent value="digital" className="pt-4 space-y-3">
                      {data.type !== 'digital' && (
                        <div className="flex items-start gap-2 p-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
                          <AlertCircle className="w-4 h-4 mt-0.5" />
                          <p className="text-sm">
                            Le type du produit n'est pas <strong>numérique</strong>. Ces champs sont facultatifs et peuvent rester vides.
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            URL de téléchargement
                          </label>
                          <Input
                            type="url"
                            placeholder="https://..."
                            value={data.download_url}
                            onChange={e => setData('download_url', e.target.value)}
                            disabled={false}
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Limite de téléchargement
                          </label>
                          <Input
                            type="number"
                            min="1"
                            value={data.download_limit}
                            onChange={e => setData('download_limit', e.target.value)}
                            disabled={false}
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Expiration (jours)
                          </label>
                          <Input
                            type="number"
                            min="1"
                            value={data.download_expiry_days}
                            onChange={e => setData('download_expiry_days', e.target.value)}
                            disabled={false}
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </TabsContent>

                    {/* --- Images --- */}
                    <TabsContent value="images" className="pt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Images du produit
                        </label>
                        <label className="cursor-pointer flex flex-col items-center justify-center py-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                          <UploadCloud className="h-6 w-6 text-slate-400 mb-2" />
                          <p className="text-sm text-slate-500 dark:text-slate-400">Cliquez ou déposez vos images ici (max. 7)</p>
                          <input type="file" multiple className="hidden" onChange={handleFiles} />
                        </label>
                      </div>

                      {previews.length > 0 && (
                        <motion.div layout className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {previews.map((src, i) => (
                            <motion.div layout key={i} className="relative">
                              <img src={src} className="h-32 w-full object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800"
                                onClick={() => removeImage(i)}
                                type="button"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                onClick={() => choosePrimary(i)}
                                className={`absolute bottom-1 left-1 px-2 py-0.5 text-xs rounded ${
                                  data.primary_image_index === i
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                }`}
                              >
                                {data.primary_image_index === i ? 'Principale' : 'Choisir'}
                              </Button>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </TabsContent>

                    {/* --- Compatibilités --- */}
                    <TabsContent value="compat" className="pt-4 space-y-4">
                      {(() => {
                        if (!data.category_id) {
                          return (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Sélectionnez d'abord une catégorie pour gérer les compatibilités.
                            </p>
                          )
                        }

                        // options de la liste = produits filtrés pour ne pas proposer ceux déjà sélectionnés
                        const options = (allProducts ?? []).filter(p => !compatIds.has(p.id))

                        // util: retrouver le nom d'un produit depuis l'id
                        const nameOf = (id: string) => options.find(p => p.id === id)?.name
                          ?? allProducts.find(p => p.id === id)?.name
                          ?? id

                        return (
                          <div className="space-y-4">
                            {/* Information sur la logique de compatibilité */}
                            <div className="p-3 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
                              <p className="text-sm text-blue-700 dark:text-blue-300">
                                <strong>Logique de compatibilité :</strong><br />
                                {currentCategory && (
                                  <>
                                    {' '}Votre produit appartient à la catégorie « {currentCategory.name} »
                                    {parentCategory
                                      ? <> rattachée directement à la catégorie parente « {parentCategory.name} ».</>
                                      : <> (catégorie racine).</>
                                    }
                                  </>
                                )}
                              </p>
                            </div>
                            {/* Sélecteur d'ajout */}
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                  Ajouter un produit compatible
                                </label>
                                <Select value={selectedCompatId} onValueChange={setSelectedCompatId}>
                                  <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                                    <SelectValue placeholder="Choisir un produit…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {options.length === 0 ? (
                                      <div className="px-3 py-2 text-sm text-slate-500">Aucun produit disponible</div>
                                    ) : options.map(p => (
                                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="md:pb-[2px]">
                                <Button type="button" onClick={addSelectedCompatibility} disabled={!selectedCompatId}>
                                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                                </Button>
                              </div>
                            </div>

                            {/* Liste des compatibilités sélectionnées */}
                            {(data.compatibilities ?? []).length === 0 ? (
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                Aucun produit compatible sélectionné.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                {(data.compatibilities ?? []).map(c => (
                                  <div key={c.compatible_with_id} className="p-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60">
                                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                                          {nameOf(c.compatible_with_id)}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                                          {c.compatible_with_id}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <Select
                                          value={c.direction ?? 'bidirectional'}
                                          onValueChange={(v) => updateCompatibility(c.compatible_with_id, { direction: v as 'bidirectional' | 'uni' })}
                                        >
                                          <SelectTrigger className="w-[160px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                                            <SelectValue placeholder="Direction" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="bidirectional">Bidirectionnel</SelectItem>
                                            <SelectItem value="uni">Unidirectionnel</SelectItem>
                                          </SelectContent>
                                        </Select>

                                        <Button type="button" variant="ghost" onClick={() => removeCompatibility(c.compatible_with_id)}>
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="mt-3">
                                      <Input
                                        placeholder="Note (facultatif)"
                                        value={c.note ?? ''}
                                        onChange={(e) => updateCompatibility(c.compatible_with_id, { note: e.target.value })}
                                        className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Messages de validation backend éventuels */}
                            {(errors as any)['compatibilities'] && (
                              <p className="text-sm text-red-600">{String((errors as any)['compatibilities'])}</p>
                            )}
                            {(errors as any)['compatibilities.0.compatible_with_id'] && (
                              <p className="text-sm text-red-600">{String((errors as any)['compatibilities.0.compatible_with_id'])}</p>
                            )}
                          </div>
                        )
                      })()}
                    </TabsContent>

                    {/* --- SEO --- */}
                    <TabsContent value="seo" className="pt-4 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Meta title
                          </label>
                          <Input
                            value={data.meta_title}
                            onChange={e => setData('meta_title', e.target.value)}
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Mots-clés (meta)
                          </label>
                          <Input
                            value={data.meta_keywords}
                            onChange={e => setData('meta_keywords', e.target.value)}
                            placeholder="mot1, mot2, mot3"
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Meta description
                        </label>
                        <Textarea
                          value={data.meta_description}
                          onChange={e => setData('meta_description', e.target.value)}
                          className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          rows={3}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Actions */}
                  <div className="flex justify-between pt-2">
                    <Button
                      type="button"
                      onClick={() => history.back()}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-0"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" /> Annuler
                    </Button>

                    <Button
                      type="submit"
                      disabled={processing}
                      className="group relative flex items-center justify-center
                                 rounded-lg bg-gradient-to-r from-red-600 to-red-500 px-6 py-3
                                 text-sm font-semibold text-white shadow-md transition-all
                                 hover:from-red-500 hover:to-red-600 focus:ring-2 focus:ring-red-500"
                    >
                      {processing
                        ? (<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />)
                        : (<Plus className="w-4 h-4 mr-2" />)}
                      {processing ? 'Création…' : 'Créer le produit'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>

          </div>
        </AppLayout>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Utils                                                              */
/* ------------------------------------------------------------------ */
function safeJsonParse(input: string, fallback: any) {
  try {
    const v = JSON.parse(input)
    return typeof v === 'object' && v !== null ? v : fallback
  } catch {
    return fallback
  }
}

function toFloat(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function round2(n: number) { return Math.round(n * 100) / 100 }
function round1(n: number) { return Math.round(n * 10) / 10 }

function formatMoney(n: number, symbol: string) {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`.trim()
}

function computeMinAllowedPrice(price: number, type: '' | ToleranceTypeUI, value: string | number): number | null {
  if (!type) return null
  const v = toFloat(value)
  if (v < 0) return Math.max(0, price) // valeur négative -> ignore, garde le prix
  if (type === 'percentage') {
    return Math.max(0, round2(price * (1 - v / 100)))
  }
  if (type === 'amount') {
    return Math.max(0, round2(price - v))
  }
  return null
}
