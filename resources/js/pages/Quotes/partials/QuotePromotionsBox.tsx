import React, { useMemo, useState } from 'react'
import { route } from 'ziggy-js'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Banknote, Tag, Loader2, CheckCircle2, AlertTriangle, Info, X,
} from 'lucide-react'
import toast from 'react-hot-toast'

type ApplyLineBreakdown = { index: number; amount: number }

/** Métadonnées statiques envoyées par le back pour la promo */
type PromoMeta = {
  percent?: number
  percentage?: number
  rate?: number
  value_percent?: number
  value_fixed?: number
  fixed_amount?: number
}

type AppliedPromotion = PromoMeta & {
  promotion_id: number
  promotion_code_id?: number | null
  name: string
  amount: number
  lines_breakdown?: ApplyLineBreakdown[]
}

type PreviewResponse = {
  discount_total?: number
  applied_promotions?: AppliedPromotion[]

  subtotal?: number
  tax_total?: number
  grand_total?: number
  grand_total_after?: number

  message?: string
}

type ApplyResponse = {
  quote_id: number | string
  discount_total: number
  applied_promotions: AppliedPromotion[]
  subtotal_ht?: number
  total_tax?: number
  total_ttc?: number
}

/** ---------------- CSRF helpers ---------------- */
function getCsrfTokenFromMeta() {
  return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || ''
}
function getCookie(name: string) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}
async function ensureSanctumCsrf(baseUrl: string) {
  try {
    await axios.get(`${baseUrl.replace(/\/+$/,'')}/sanctum/csrf-cookie`, { withCredentials: true })
  } catch { /* no-op */ }
}

/** Helpers d'affichage */
function fmtAmount(v?: number) {
  const n = Number(v ?? 0)
  return n.toFixed(2)
}
function fmtPercent(n?: number) {
  if (n == null || isNaN(Number(n))) return null
  const v = Number(n)
  return Number.isInteger(v) ? `${v}%` : `${v.toFixed(2)}%`
}
function fmtFixedShortMAD(n:number) {
  const isInt = Math.abs(n - Math.round(n)) < 1e-9
  const num = isInt ? Math.round(n).toString() : n.toFixed(2)
  return `${num}dhs`
}
function promoSuffixStatic(p: PromoMeta) {
  const percent = p.percent ?? p.percentage ?? p.rate ?? p.value_percent
  if (percent != null) {
    const s = fmtPercent(percent)
    return s ? `(${s})` : ''
  }
  const fixed = p.value_fixed ?? p.fixed_amount
  if (fixed != null && !isNaN(Number(fixed))) {
    return `(${fmtFixedShortMAD(Number(fixed))})`
  }
  return ''
}

export default function QuotePromotionsBox({
  quoteId,
  initialCode = '',
  onApplied,
}:{
  quoteId: number | string
  initialCode?: string
  onApplied?: (payload: ApplyResponse) => void
}) {
  const [code, setCode] = useState(initialCode)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingApply, setLoadingApply] = useState(false)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)

  const discount = useMemo(
    ()=> Number(preview?.discount_total ?? 0),
    [preview?.discount_total]
  )

  const commonHeaders = () => ({
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRF-TOKEN': getCsrfTokenFromMeta(),
    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
    'Accept': 'application/json',
  })

  async function postWithCsrfRetry<T>(url: string, payload: any): Promise<T> {
    try {
      const res = await axios.post<T>(url, payload, { withCredentials: true, headers: commonHeaders() })
      return res.data
    } catch (e: any) {
      if (e?.response?.status === 419) {
        const base = new URL(url, window.location.origin).origin
        await ensureSanctumCsrf(base)
        const res2 = await axios.post<T>(url, payload, { withCredentials: true, headers: commonHeaders() })
        return res2.data
      }
      throw e
    }
  }

  async function doPreview() {
    setLoadingPreview(true)
    try {
      const data = await postWithCsrfRetry<PreviewResponse>(
        route('quotes.promotions.preview', quoteId),
        { code: code?.trim() || null }
      )
      setPreview(data)
      toast.success('Prévisualisation mise à jour')
    } catch (e: any) {
      console.error(e)
      const status = e?.response?.status
      if (status === 419) {
        toast.error('Session/CSRF invalide (419). Recharge la page.')
      } else if (status === 403) {
        toast.error("Accès refusé (403). Vérifie la permission 'quote_edit'.")
      } else {
        toast.error('Impossible de prévisualiser les promotions')
      }
    } finally {
      setLoadingPreview(false)
    }
  }

  async function doApply() {
    setLoadingApply(true)
    try {
      const json = await postWithCsrfRetry<ApplyResponse>(
        route('quotes.promotions.apply', quoteId),
        { code: code?.trim() || null }
      )
      setPreview(prev => ({ ...(prev ?? {}), discount_total: json.discount_total, applied_promotions: json.applied_promotions }))
      toast.success('Promotions appliquées au devis')
      onApplied?.(json)
    } catch (e: any) {
      console.error(e)
      const status = e?.response?.status
      if (status === 419) {
        toast.error('Session/CSRF invalide (419). Recharge la page.')
      } else if (status === 403) {
        toast.error("Accès refusé (403). Vérifie la permission 'quote_edit'.")
      } else {
        toast.error('Application impossible')
      }
    } finally {
      setLoadingApply(false)
    }
  }

  /** Retirer une promotion (front-only) + recalculs basiques */
  const disablePromotion = (idx:number) => {
    if (!preview) return
    const promos = [...(preview.applied_promotions ?? [])]
    const removed = promos.splice(idx, 1)
    if (!removed.length) return

    const discount_total = promos.reduce((s,p)=> s + Number(p.amount||0), 0)
    const subtotal = preview.subtotal ?? 0
    const tax_total = preview.tax_total ?? 0
    const grand_total = preview.grand_total ?? (subtotal + tax_total)
    const grand_total_after = Math.max(0, grand_total - discount_total)

    // Rebuild lines_total_discounts if we have breakdowns
    let lines_total_discounts: number[] = []
    if (preview.lines_total_discounts?.length) {
      lines_total_discounts = new Array(preview.lines_total_discounts.length).fill(0)
      for (const p of promos) {
        for (const b of (p.lines_breakdown ?? [])) {
          lines_total_discounts[b.index] = (lines_total_discounts[b.index] || 0) + Number(b.amount || 0)
        }
      }
    }

    setPreview({
      ...preview,
      applied_promotions: promos,
      discount_total,
      grand_total_after,
      lines_total_discounts,
    })
    toast('Promotion désactivée pour ce devis', { icon: '✖️' })
  }

  const list = preview?.applied_promotions ?? []

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
          <Tag className="w-4 h-4 text-red-600" /> Promotions
        </h3>
        {discount > 0 && (
          <span className="text-sm inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Remise estimée : <strong>{fmtAmount(discount)}</strong>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <div className="relative">
            <Input
              placeholder="Code promo (facultatif)"
              value={code}
              onChange={(e)=>setCode(e.target.value)}
              className="pr-28"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-2">
              <Button size="sm" variant="outline" onClick={doPreview} disabled={loadingPreview}>
                {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Prévisualiser'}
              </Button>
              <Button size="sm" onClick={doApply} disabled={loadingApply}>
                {loadingApply ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Appliquer'}
              </Button>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Laisser vide pour tester les promotions automatiques.
          </p>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-xs text-slate-600 dark:text-slate-300 mb-2">Remise totale estimée</div>
            <div className="text-xl font-bold flex items-center gap-2">
              <Banknote className="w-5 h-5" />
              {fmtAmount(discount)}
            </div>
          </div>
        </div>
      </div>

      {/* Liste des promos appliquées */}
      {list.length > 0 ? (
        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2 pr-4">Nom</th>
                <th className="py-2 pr-4">Montant</th>
                <th className="py-2">Par lignes</th>
                <th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {list.map((p, idx)=> {
                const hasBreakdown = (p.lines_breakdown?.length ?? 0) > 0
                return (
                  <tr key={`${p.promotion_id}-${idx}`}>
                    <td className="py-2 pr-4">
                      {p.name} <span className="text-slate-500">{promoSuffixStatic(p)}</span>
                    </td>
                    <td className="py-2 pr-4 flex items-center gap-1">
                      <Banknote className="w-4 h-4" />
                      {fmtAmount(p.amount)}
                    </td>
                    <td className="py-2">
                      {hasBreakdown ? (
                        <Badge variant="secondary">
                          {p.lines_breakdown!.length} ligne(s)
                        </Badge>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        variant="ghost" size="icon"
                        title="Désactiver cette promotion"
                        onClick={()=>disablePromotion(idx)}
                        className="h-7 w-7"
                      >
                        <X className="w-4 h-4 text-slate-500 hover:text-red-600" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        preview && (
          <div className="mt-4 text-sm flex items-center gap-2 text-slate-500">
            <AlertTriangle className="w-4 h-4" />
            {preview.message || 'Aucune promotion applicable pour l’instant.'}
          </div>
        )
      )}
    </div>
  )
}
