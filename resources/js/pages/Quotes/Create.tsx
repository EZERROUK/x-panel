/* ------------------------------------------------------------------ */
/* resources/js/pages/Quotes/Create.tsx                               */
/* ------------------------------------------------------------------ */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Head, useForm } from '@inertiajs/react'
import { route } from 'ziggy-js'
import {
  Building2, CreditCard, Calendar, FileText,
  Package2 as Package, Plus, Trash2, ArrowLeft,
  Loader2, Percent, Check, Tag, Zap, XCircle, X,
} from 'lucide-react'
import toast from 'react-hot-toast'

import AppLayout           from '@/layouts/app-layout'
import ParticlesBackground from '@/components/ParticlesBackground'
import { Button }          from '@/components/ui/button'
import { Input }           from '@/components/ui/input'
import { Textarea }        from '@/components/ui/textarea'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
interface Client   { id:number; company_name:string; contact_name?:string }
interface Currency { code:string; symbol:string; name:string }
interface Product  { id:string|number; name:string; sku:string; price:number; tax_rate?:{ rate:number } }

export interface QuoteItem {
  product_id   : string
  quantity     : number
  unit_price_ht: number
  tax_rate     : number
}

type LineBreakdown = { index:number; amount:number }

/** Métadonnées statiques envoyées par le back pour la promo */
type PromoMeta = {
  percent?: number
  percentage?: number
  rate?: number
  value_percent?: number
  value_fixed?: number
  fixed_amount?: number
}

type PreviewPromotion = PromoMeta & {
  name: string
  amount: number
  lines_breakdown?: LineBreakdown[]
}

interface DuplicateData {
  client_id:number; currency_code:string; quote_date:string; valid_until:string;
  terms_conditions?:string; notes?:string; internal_notes?:string;
  items:QuoteItem[]
}

/** Typage du formulaire Inertia */
type QuoteFormData = {
  client_id        : string
  currency_code    : string
  quote_date       : string
  valid_until      : string
  terms_conditions : string
  notes            : string
  internal_notes   : string
  items            : QuoteItem[]

  promo_code       : string
  discount_total   : number
  applied_promotions: PreviewPromotion[]
}

interface Props {
  clients        : Client[]
  products       : Product[]
  currencies     : Currency[]
  duplicateQuote?: DuplicateData|null
}

/* ------------------------------------------------------------------ */
/* CSRF helpers                                                       */
/* ------------------------------------------------------------------ */
function getCsrfTokenFromMeta() {
  return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || ''
}
function getCookie(name: string) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
const normalizeDuplicateItems = (items: QuoteItem[]): QuoteItem[] =>
  items.map(it => ({
    product_id   : String(it.product_id),
    quantity     : Number(it.quantity)      || 1,
    unit_price_ht: Number((it as any).unit_price_ht ?? (it as any).unit_price_ht_snapshot ?? 0),
    tax_rate     : Number((it as any).tax_rate      ?? (it as any).tax_rate_snapshot      ?? 0),
  }))

const debounce = <A extends any[]>(fn: (...args:A) => void, delay = 400) => {
  let t: number | undefined
  return (...args: A) => {
    if (t) window.clearTimeout(t)
    t = window.setTimeout(() => fn(...args), delay)
  }
}

const fmtPercent = (n?: number) => {
  if (n == null || isNaN(Number(n))) return null
  const v = Number(n)
  return Number.isInteger(v) ? `${v}%` : `${v.toFixed(2)}%`
}

/* ------------------------------------------------------------------ */
/* Page component                                                     */
/* ------------------------------------------------------------------ */
export default function CreateQuote({ clients, products, currencies, duplicateQuote = null }: Props) {

  /* Inertia form — typé pour éviter les erreurs TS */
  const { data, setData, post, processing, errors, reset } = useForm<QuoteFormData>({
    client_id       : duplicateQuote?.client_id?.toString() ?? '',
    currency_code   : duplicateQuote?.currency_code ?? currencies[0]?.code ?? 'MAD',
    quote_date      : duplicateQuote?.quote_date ?? new Date().toISOString().slice(0,10),
    valid_until     : duplicateQuote?.valid_until ?? new Date(Date.now()+30*24*60*60*1000).toISOString().slice(0,10),

    terms_conditions: duplicateQuote?.terms_conditions ?? '',
    notes           : duplicateQuote?.notes ?? '',
    internal_notes  : duplicateQuote?.internal_notes ?? '',

    items: duplicateQuote?.items ? normalizeDuplicateItems(duplicateQuote.items) : [],

    promo_code      : '',
    discount_total  : 0,
    applied_promotions: [],
  })

  const productsIndex = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products) m.set(String(p.id), p)
    return m
  }, [products])

  /* UI state promos (preview transient) */
  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<null | {
    subtotal: number
    tax_total: number
    grand_total: number
    discount_total: number
    grand_total_after: number
    applied_promotions: PreviewPromotion[]
    lines_total_discounts: number[]
  }>(null)

  /* Helpers format */
  const currencySymbol = useMemo(
    () => currencies.find(c=>c.code===data.currency_code)?.symbol ?? data.currency_code,
    [currencies, data.currency_code]
  )
  const fmt = (n:number)=> `${n.toLocaleString('fr-FR',{minimumFractionDigits:2})} ${currencySymbol}`

  const fmtFixedShort = (n:number)=> {
    const isInt = Math.abs(n - Math.round(n)) < 1e-9
    const num = isInt ? Math.round(n).toString() : n.toFixed(2)
    if (data.currency_code === 'MAD' || currencySymbol === 'MAD') return `${num}dhs`
    if (['€', '$', '£', '¥'].includes(currencySymbol)) return `${num}${currencySymbol}`
    return `${num}${currencySymbol}`
  }

  /** suffixe affiché à côté du nom : (10%) ou (10dhs) — seulement valeurs statiques */
  const promoSuffix = (p: PromoMeta) => {
    const percent = p.percent ?? p.percentage ?? p.rate ?? p.value_percent
    if (percent != null) {
      const s = fmtPercent(percent)
      if (s) return `(${s})`
    }
    const fixed = p.value_fixed ?? p.fixed_amount
    if (fixed != null && !isNaN(Number(fixed))) {
      return `(${fmtFixedShort(Number(fixed))})`
    }
    return ''
  }

  /** Rebuild preview after removing a promotion (front-only) */
  const rebuildPreview = (promos: PreviewPromotion[]) => {
    const discount_total = promos.reduce((s,p)=> s + Number(p.amount||0), 0)
    const subtotal = preview?.subtotal ?? 0
    const tax_total = preview?.tax_total ?? 0
    const grand_total = preview?.grand_total ?? (subtotal + tax_total)
    const grand_total_after = Math.max(0, grand_total - discount_total)

    // Rebuild lines_total_discounts from lines_breakdown if available
    let lines_total_discounts: number[] = []
    if (preview?.lines_total_discounts?.length) {
      lines_total_discounts = new Array(preview.lines_total_discounts.length).fill(0)
      for (const p of promos) {
        for (const b of (p.lines_breakdown ?? [])) {
          lines_total_discounts[b.index] = (lines_total_discounts[b.index] || 0) + Number(b.amount || 0)
        }
      }
    }

    setPreview(prev => prev
      ? { ...prev, applied_promotions: promos, discount_total, grand_total_after, lines_total_discounts }
      : null
    )
  }

  /** Désactiver (retirer) une promotion de l'aperçu courant */
  const disablePromotion = (idx:number) => {
    if (!preview) return
    const promos = [...(preview.applied_promotions ?? [])]
    const removed = promos.splice(idx, 1)
    if (!removed.length) return
    rebuildPreview(promos)
    toast('Promotion désactivée pour ce devis', { icon: '✖️' })
  }

  const addItem = () =>
    setData('items', [...data.items, { product_id:'', quantity:1, unit_price_ht:0, tax_rate:0 }])

  const removeItem = (idx:number) => {
    const arr = [...data.items]
    arr.splice(idx, 1)
    setData('items', arr)
  }

  const updateItem = (idx:number, field:keyof QuoteItem, value:any) => {
    const arr = [...data.items]
    switch(field){
      case 'product_id':{
        const id = String(value)
        arr[idx].product_id = id
        const p = productsIndex.get(id)
        if (p) {
          arr[idx].unit_price_ht = Number(p.price) || 0
          arr[idx].tax_rate      = Number((p as any).tax_rate?.rate ?? 0)
        } else {
          arr[idx].unit_price_ht = 0
          arr[idx].tax_rate      = 0
        }
        break
      }
      case 'quantity':
        arr[idx].quantity = Math.max(0, Number(value) || 0)
        break
      case 'unit_price_ht':
        arr[idx].unit_price_ht = Math.max(0, Number(value) || 0)
        break
      case 'tax_rate':
        arr[idx].tax_rate = Math.max(0, Number(value) || 0)
        break
    }
    setData('items', arr)
  }

  /* Totaux (hors promo) */
  const baseTotals = useMemo(()=>{
    let sub=0, tva=0
    data.items.forEach(it=>{
      const ht = Number(it.quantity) * Number(it.unit_price_ht)
      sub += ht
      tva += ht * Number(it.tax_rate) / 100
    })
    return { sub, tva, ttc: sub+tva }
  }, [data.items])

  /* Preview promotions (transient) */
  const doPreview = useMemo(() => debounce(async (payload: {items: QuoteItem[], code?: string}) => {
    if (!payload.items || payload.items.length === 0) {
      setPreview(null)
      return
    }

    const validItems = payload.items.filter((item: QuoteItem) =>
      item.product_id && Number(item.quantity) > 0 && Number(item.unit_price_ht) > 0
    )
    if (validItems.length === 0) {
      setPreview(null)
      return
    }

    const url = route('quotes.promotions.preview.transient')
    const body = JSON.stringify({
      ...payload,
      items: validItems.map((it: QuoteItem) => ({
        product_id   : String(it.product_id),
        quantity     : Number(it.quantity) || 0,
        unit_price_ht: Number(it.unit_price_ht) || 0,
        tax_rate     : Number(it.tax_rate) || 0,
      })),
    })

    try {
      setPreviewLoading(true)
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-TOKEN': getCsrfTokenFromMeta(),
          'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
        },
        credentials: 'include',
        body,
      })

      if (res.status === 419) {
        try {
          const apiOrigin = new URL(url, window.location.origin).origin
          await fetch(`${apiOrigin}/sanctum/csrf-cookie`, { credentials: 'include' })
          const res2 = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              'X-CSRF-TOKEN': getCsrfTokenFromMeta(),
              'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
            },
            credentials: 'include',
            body,
          })
          if (!res2.ok) {
            const t2 = await res2.text()
            throw new Error(`Erreur ${res2.status} - ${t2}`)
          }
          const json2 = await res2.json()
          setPreview(json2)
          if (json2.applied_promotions?.length > 0) {
            toast.success(`${json2.applied_promotions.length} promotion(s) appliquée(s)`)
          }
          return
        } catch {
          throw new Error('Session/CSRF invalide (419). Recharge la page.')
        }
      }

      if (!res.ok) {
        const t = await res.text()
        throw new Error(`Erreur ${res.status} - ${t}`)
      }

      const json = await res.json()
      setPreview(json)
      if (json.applied_promotions && json.applied_promotions.length > 0) {
        toast.success(`${json.applied_promotions.length} promotion(s) appliquée(s)`)
      }
    } catch (e:any) {
      console.error('Erreur preview:', e)
      toast.error(e?.message || 'Erreur preview promotions')
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }, 500), [setPreviewLoading, setPreview, data.currency_code])

  useEffect(()=>{
    const code = data.promo_code?.trim()?.toUpperCase() || undefined
    doPreview({ items: data.items, code })
  }, [data.items, data.promo_code, doPreview])

  const applyPreview = () => {
    if (!preview) {
      toast.error('Aucune prévisualisation disponible')
      return
    }
    setData('discount_total', preview.discount_total)
    setData('applied_promotions', preview.applied_promotions)
    toast.success('Remise appliquée au devis (aperçu)')
  }

  /* Submit */
  const canSubmit = data.items.length>0 && data.items.every(it=>it.product_id && it.quantity>0)
  const submit = (e:React.FormEvent) =>{
    e.preventDefault()
    if(!canSubmit){
      toast.error('Ajoutez au moins une ligne.')
      return
    }
    post(route('quotes.store'),{
      onSuccess:()=>{ toast.success('Devis créé.'); reset() },
      onError  :()=> toast.error('Erreur lors de la création.'),
      preserveScroll: true,
    })
  }

  /* Render */
  return (
    <>
      <Head title="Créer un devis" />
      <div className="relative min-h-screen bg-gradient-to-br from-white via-slate-100 to-slate-200 dark:from-[#0a0420] dark:via-[#0e0a32] dark:to-[#1B1749]">
        <ParticlesBackground />
        <AppLayout breadcrumbs={[{title:'Devis',href:'/quotes'},{title:'Créer',href:''}]}>

          {/* En-tête */}
          <div className="px-6 pt-6 mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-red-600"/> Créer un devis
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Renseignez les informations, ajoutez vos lignes — les promotions s’appliquent automatiquement.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6 p-6">
            {/* Colonne principale */}
            <div className="col-span-12 lg:col-span-8">
              <div className="rounded-xl border border-slate-200 bg-white shadow-xl dark:bg-white/5 dark:border-slate-700 backdrop-blur-md p-8">

                {Object.keys(errors).length>0 && (
                  <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800">
                    <strong>Veuillez corriger :</strong>
                    <ul className="list-disc list-inside mt-2 text-sm">
                      {Object.entries(errors).map(([k,m])=> <li key={k}>{String(m)}</li>)}
                    </ul>
                  </div>
                )}

                <form onSubmit={submit} className="space-y-8">

                  {/* Informations générales */}
                  <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SelectBlock
                      label="Client *" Icon={Building2}
                      value={data.client_id}
                      onChange={(v)=>setData('client_id',v)}
                      options={clients.map(c=>({value:String(c.id),label:c.company_name}))}
                      error={errors.client_id as any}
                    />
                    <SelectBlock
                      label="Devise" Icon={CreditCard}
                      value={data.currency_code}
                      onChange={(v)=>setData('currency_code',v)}
                      options={currencies.map(c=>({value:c.code,label:`${c.name} (${c.symbol})`}))}
                    />
                    <DateInputField
                      label="Date du devis *"
                      value={data.quote_date}
                      onChange={(v)=>setData('quote_date',v)}
                      error={errors.quote_date as any}
                    />
                    <DateInputField
                      label="Échéance *"
                      value={data.valid_until}
                      onChange={(v)=>setData('valid_until',v)}
                      error={errors.valid_until as any}
                    />
                  </section>

                  {/* Lignes */}
                  <section>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <Package className="w-5 h-5 text-red-600"/> Lignes ({data.items.length})
                      </h2>
                      <Button type="button" onClick={addItem}>
                        <Plus className="w-4 h-4 mr-1"/> Ajouter une ligne
                      </Button>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-[#0a0420] text-slate-600 dark:text-slate-300">
                          <tr>
                            <th className="px-4 py-3 text-left  font-medium">Produit</th>
                            <th className="px-4 py-3 text-center font-medium w-28">Qté</th>
                            <th className="px-4 py-3 text-center font-medium w-40">PU HT</th>
                            <th className="px-4 py-3 text-center font-medium w-32">TVA (%)</th>
                            <th className="px-4 py-3 text-right font-medium  w-36">Total HT</th>
                            <th className="px-4 py-3 text-right font-medium  w-36">Remise (aperçu)</th>
                            <th className="px-2 py-3 w-10" />
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {data.items.length===0 && (
                            <tr>
                              <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                                Aucune ligne. Cliquez sur “Ajouter une ligne”.
                              </td>
                            </tr>
                          )}

                          {data.items.map((it,i)=>{
                            const htLine = it.quantity * it.unit_price_ht
                            const previewLineDiscount = preview?.lines_total_discounts?.[i] ?? 0
                            return (
                              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-[#0a0420]/60">
                                {/* Produit */}
                                <td className="px-4 py-2">
                                  <Select value={it.product_id} onValueChange={v=>updateItem(i,'product_id',v)}>
                                    <SelectTrigger className="h-9 w-full bg-transparent border-0 px-0 focus:ring-0">
                                      <SelectValue placeholder="Sélectionner…" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-72">
                                      {products.map(p=>(
                                        <SelectItem key={String(p.id)} value={String(p.id)}>
                                          <div className="flex flex-col">
                                            <span className="font-medium">{p.name}</span>
                                            <span className="text-xs text-slate-500">SKU : {p.sku} · ID: {String(p.id)}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>

                                {/* Qté */}
                                <td className="px-4 py-2 text-center">
                                  <Input
                                    type="number" min={0} step={1}
                                    value={it.quantity}
                                    onChange={e=>updateItem(i,'quantity',e.target.value)}
                                    className="text-center bg-transparent border-0 focus:bg-white dark:focus:bg-[#0a0420]"
                                  />
                                </td>

                                {/* PU HT */}
                                <td className="px-4 py-2 text-center">
                                  <Input
                                    type="number" min={0} step="0.01"
                                    value={it.unit_price_ht}
                                    onChange={e=>updateItem(i,'unit_price_ht',e.target.value)}
                                    className="text-center bg-transparent border-0 focus:bg-white dark:focus:bg-[#0a0420]"
                                  />
                                </td>

                                {/* TVA (%) */}
                                <td className="px-4 py-2 text-center">
                                  <Input
                                    type="number" min={0} step="0.01" readOnly value={it.tax_rate}
                                    className="text-center bg-slate-100 dark:bg-[#0a0420]/60 border-0 cursor-not-allowed"
                                  />
                                </td>

                                {/* Total HT */}
                                <td className="px-4 py-2 text-right font-medium">{fmt(htLine)}</td>

                                {/* Remise (aperçu) */}
                                <td className="px-4 py-2 text-right">
                                  {previewLoading ? (
                                    <span className="inline-flex items-center text-slate-400">
                                      <Loader2 className="w-4 h-4 animate-spin mr-1" />Calcul…
                                    </span>
                                  ) : (
                                    <span className={previewLineDiscount>0 ? 'text-green-600 font-medium' : 'text-slate-400'}>
                                      {previewLineDiscount>0 ? `- ${fmt(previewLineDiscount)}` : '—'}
                                    </span>
                                  )}
                                </td>

                                {/* Delete */}
                                <td className="px-2 py-2 text-center">
                                  <Button
                                    variant="ghost" size="icon" onClick={()=>removeItem(i)}
                                    className="hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600"/>
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Promotions */}
                    <div className="mt-6 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-red-600"/> Promotions
                      </h3>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Code promo (optionnel)"
                          value={data.promo_code}
                          onChange={e=>setData('promo_code', e.target.value.toUpperCase())}
                          className="uppercase"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={()=>doPreview({ items: data.items, code: data.promo_code?.trim()?.toUpperCase() || undefined })}
                          disabled={previewLoading}
                        >
                          {previewLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1"/> : <Zap className="w-4 h-4 mr-1"/>}
                          Prévisualiser
                        </Button>
                      </div>

                      {/* Liste des promos appliquées (nom + (meta statique) + montant + X) */}
                      <div className="mt-3 space-y-2">
                        {preview?.applied_promotions?.length
                          ? preview.applied_promotions.map((p, idx)=>(
                              <div
                                key={idx}
                                className="text-sm flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {p.name}{' '}
                                    <span className="text-slate-500">{promoSuffix(p)}</span>
                                  </span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="text-green-600 font-bold">- {fmt(p.amount)}</span>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    title="Désactiver cette promotion"
                                    onClick={()=>disablePromotion(idx)}
                                    className="h-7 w-7"
                                  >
                                    <X className="w-4 h-4 text-slate-500 hover:text-red-600" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          : (
                            <div className="text-xs text-slate-500 flex items-center gap-2 p-2">
                              <XCircle className="w-4 h-4"/>
                              {previewLoading ? 'Recherche de promotions…' : 'Aucune promotion applicable'}
                            </div>
                          )
                        }
                      </div>

                      {preview && preview.applied_promotions?.length > 0 && (
                        <div className="mt-3">
                          <Button type="button" onClick={applyPreview} disabled={previewLoading} className="w-full">
                            <Check className="w-4 h-4 mr-1"/> Appliquer la remise
                          </Button>
                        </div>
                      )}
                    </div>
                  </section>
                </form>
              </div>
            </div>

            {/* Colonne droite : Totaux sticky (TVA sous Sous-total HT) */}
            <div className="col-span-12 lg:col-span-4">
              <div className="sticky top-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 p-6">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Percent className="w-4 h-4 text-red-600"/> Totaux
                  </h3>

                  <div className="space-y-2 text-sm">
                    <Row label="Sous-total HT" value={fmt(baseTotals.sub)} />
                    <Row label="TVA"           value={fmt(baseTotals.tva)} />
                    <Row label="Total TTC"     value={fmt(baseTotals.ttc)} bold />

                    <div className="border-t border-slate-200 dark:border-slate-700 my-2" />

                    <Row
                      label="Remise (aperçu)"
                      value={previewLoading ? '…' : `- ${fmt(preview?.discount_total ?? 0)}`}
                      accent="green"
                    />
                    <Row
                      label="Total TTC après remise"
                      value={previewLoading
                        ? '…'
                        : fmt(preview ? preview.grand_total_after : baseTotals.ttc)}
                      bold
                    />
                  </div>

                  <div className="flex justify-between gap-2 pt-6">
                    <Button variant="ghost" onClick={()=>window.history.back()}>
                      <ArrowLeft className="w-4 h-4 mr-2"/> Annuler
                    </Button>
                    <Button
                      type="button"
                      onClick={(e)=>{ e.preventDefault(); document.querySelector<HTMLFormElement>('form')?.requestSubmit() }}
                      disabled={processing || !canSubmit}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white px-6 py-3 shadow-md"
                    >
                      {processing ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileText className="w-4 h-4"/>}
                      {processing ? 'Création…' : 'Créer le devis'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </AppLayout>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Sous-composants                                                    */
/* ------------------------------------------------------------------ */
const Label = ({children}:{children:React.ReactNode}) => (
  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
    {children}
  </label>
)

function SelectBlock({
  label, Icon, value, onChange, options, error,
}:{
  label:string; Icon:any; value:string; onChange:(v:string)=>void;
  options:{value:string;label:string}[]; error?:string|false
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"/>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger
            className={`pl-10 bg-white dark:bg-[#0a0420] border-slate-300 dark:border-white/10
                        text-slate-900 dark:text-white focus:border-red-500 focus:ring-1 focus:ring-red-500
                        ${error ? 'border-red-500 text-red-500' : ''}`}
          >
            <SelectValue placeholder="Sélectionner…" />
          </SelectTrigger>
          <SelectContent>
            {options.map(o=> <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function DateInputField({
  label, value, onChange, error,
}:{ label:string; value:string; onChange:(v:string)=>void; error?:string|false }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <Input
          ref={ref}
          type="date"
          value={value}
          onChange={e=>onChange(e.target.value)}
          className="pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0
                     [&::-webkit-calendar-picker-indicator]:absolute
                     [&::-webkit-calendar-picker-indicator]:right-2
                     [&::-webkit-calendar-picker-indicator]:h-6
                     [&::-webkit-calendar-picker-indicator]:w-6
                     [&::-webkit-calendar-picker-indicator]:cursor-pointer"
        />
        <Calendar
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 cursor-pointer"
          onClick={()=>ref.current?.showPicker?.()}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function Row({
  label, value, bold = false, accent,
}:{ label:string; value:string; bold?:boolean; accent?:'green'|'red' }) {
  const accentCls = accent==='green' ? 'text-green-600' : accent==='red' ? 'text-red-600' : ''
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-semibold' : ''}`}>
      <span>{label}</span>
      <span className={accentCls}>{value}</span>
    </div>
  )
}
