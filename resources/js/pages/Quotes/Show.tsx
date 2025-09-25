import React, { useMemo, useState, useCallback, JSX } from 'react'
import { Head, Link, router, usePage } from '@inertiajs/react'
import { route } from 'ziggy-js'
import {
  ArrowLeft,
  Pencil,
  Info,
  FileText,
  Package,
  Calendar,
  Building2,
  Clock,
  Shield,
  Receipt,
  Download,
  CopyPlus,
  ChevronDown,
  Loader2,
  CalendarDays,
  FileCheck,
  Tag,
} from 'lucide-react'

import AppLayout           from '@/layouts/app-layout'
import ParticlesBackground from '@/components/ParticlesBackground'
import { Button }          from '@/components/ui/button'
import type { PageProps }  from '@/types'

/* ------------------------------------------------------------------ */
/* Types & Props                                                      */
/* ------------------------------------------------------------------ */
type Tab = 'details' | 'items' | 'notes' | 'history'

type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted'

interface QuoteItem {
  id                     : number
  product_name_snapshot  : string
  product_sku_snapshot   : string
  quantity               : number
  unit_price_ht_snapshot : number | null
  tax_rate_snapshot      : number | null
  unit_price_ht?         : number | null
  tax_rate?              : number | null
  product?               : { name: string; sku: string }

  // Si tu exposes ces champs côté back (facultatif, sinon on recalcule)
  line_total_ht?         : number | null
  line_tax_amount?       : number | null
  line_total_ttc?        : number | null
  discount_amount?       : number | null
}

interface QuoteStatusHistory {
  from_status: QuoteStatus | null
  to_status  : QuoteStatus
  comment?   : string
  created_at : string
  user?      : { name: string }
}

type PromotionHint = { type: 'percent'|'fixed'; value: number }

interface AppliedPromotion {
  promotion_id     : number
  promotion_code_id?: number|null
  name             : string
  amount           : number
  lines_breakdown? : { index:number; amount:number }[]
  hint?            : PromotionHint | null
}

interface Quote {
  id              : number
  quote_number    : string
  status          : QuoteStatus
  quote_date      : string
  valid_until     : string
  currency_code   : string
  currency_symbol?: string
  client          : { id: number; company_name: string; contact_name?: string }
  items           : QuoteItem[]
  terms_conditions?: string
  notes?          : string
  internal_notes? : string
  subtotal_ht?    : number
  total_tax?      : number
  total_ttc?      : number
  discount_total? : number
  applied_promotions?: AppliedPromotion[]
  status_histories?: QuoteStatusHistory[]
}

interface Props extends PageProps<{ quote: Quote }> {}

/* ------------------------------ Permissions ------------------------------ */
const useCan = () => {
  const { props } = usePage<{ auth?: { roles?: string[]; permissions?: string[] } }>()
  const roles = props.auth?.roles ?? []
  const perms = props.auth?.permissions ?? []
  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('super-admin')
  const set = useMemo(() => new Set(perms), [perms.join(',')])
  const can = (p?: string) => !p || isSuperAdmin || set.has(p)
  return { can, isSuperAdmin }
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */
export default function QuoteShow({ quote }: Props) {
  const { can } = useCan()

  const [activeTab,        setActiveTab]        = useState<Tab>('items')
  const [statusMenuOpen,   setStatusMenuOpen]   = useState(false)

  const [commentModalOpen, setCommentModalOpen] = useState(false)
  const [pendingStatus,    setPendingStatus]    = useState<QuoteStatus | null>(null)
  const [comment,          setComment]          = useState('')
  const [changingStatus,   setChangingStatus]   = useState(false)

  const [conversionModalOpen, setConversionModalOpen] = useState(false)
  const [invoiceDate,         setInvoiceDate]         = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [invoiceDueDate,      setInvoiceDueDate]      = useState(() => {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)
    return dueDate.toISOString().split('T')[0]
  })
  const [invoiceNotes,        setInvoiceNotes]        = useState(quote.notes || '')
  const [convertingToInvoice, setConvertingToInvoice] = useState(false)

  /* ----------------------------- Helpers --------------------------- */
  const statusLabel: Record<QuoteStatus, string> = {
    draft    : 'Brouillon',
    sent     : 'Envoyé',
    viewed   : 'Consulté',
    accepted : 'Accepté',
    rejected : 'Refusé',
    expired  : 'Expiré',
    converted: 'Converti',
  }

  const statusColor: Record<QuoteStatus, 'red' | 'green' | 'secondary' | 'default'> = {
    draft    : 'secondary',
    sent     : 'default',
    viewed   : 'default',
    accepted : 'green',
    rejected : 'red',
    expired  : 'secondary',
    converted: 'green',
  }

  const transitions: Partial<Record<QuoteStatus, QuoteStatus[]>> = {
    draft   : ['sent', 'rejected'],
    sent    : ['viewed', 'accepted', 'rejected', 'expired'],
    viewed  : ['accepted', 'rejected', 'expired'],
    accepted: ['converted'],
    expired : ['sent'],
  }

  /* --------- Formatter numéraire ---------------------------------- */
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [],
  )

  const currencySym = quote.currency_symbol || quote.currency_code
  const fmt = useCallback(
    (n?: number | string | null) => {
      const num = Number(n)
      return !isFinite(num) ? '-' : `${numberFormatter.format(num)} ${currencySym}`
    },
    [numberFormatter, currencySym],
  )

  /* ------ Totaux (fallback si back ne les donne pas) --------------- */
  const computedFromItems = useMemo(() => {
    return (quote.items || []).reduce(
      (acc, it) => {
        const unit = Number(it.unit_price_ht_snapshot ?? it.unit_price_ht ?? 0)
        const ht   = unit * Number(it.quantity ?? 0)
        const tvaR = Number(it.tax_rate_snapshot ?? it.tax_rate ?? 0) / 100
        const tax  = ht * tvaR
        return { sub: acc.sub + ht, tva: acc.tva + tax, ttc: acc.ttc + ht + tax }
      },
      { sub: 0, tva: 0, ttc: 0 },
    )
  }, [quote.items])

  const totalsServer = {
    sub : Number(quote.subtotal_ht ?? NaN),
    tva : Number(quote.total_tax   ?? NaN),
    ttc : Number(quote.total_ttc   ?? NaN),
    disc: Number(quote.discount_total ?? 0),
  }

  const totals = {
    sub : isFinite(totalsServer.sub) ? totalsServer.sub : computedFromItems.sub,
    tva : isFinite(totalsServer.tva) ? totalsServer.tva : computedFromItems.tva,
    ttc : isFinite(totalsServer.ttc) ? totalsServer.ttc : computedFromItems.ttc,
    disc: totalsServer.disc,
  }

  /* ------------------------- Permissions Check -------------------- */
  const canEdit = can('quote_edit') && quote.status === 'draft'
  const canExport = can('quote_export')
  const canDuplicate = can('quote_duplicate')
  const canChangeStatus = can('quote_change_status')
  const canConvertToInvoice = can('quote_convert_to_invoice') && quote.status === 'accepted'

  /* ------------------------- Actions ------------------------------- */
  const exportPdf = () => {
    if (!canExport) { alert('Permission manquante: quote_export'); return }
    window.open(route('quotes.export', quote.id), '_blank', 'noopener')
  }

  const duplicateQuote = () => {
    if (!canDuplicate) { alert('Permission manquante: quote_duplicate'); return }
    router.post(route('quotes.duplicate', quote.id))
  }

  const openConversionModal = () => {
    if (!canConvertToInvoice) { alert('Permission manquante: quote_convert_to_invoice'); return }
    setConversionModalOpen(true)
  }

  const closeConversionModal = () => {
    setConversionModalOpen(false)
    const today = new Date()
    setInvoiceDate(today.toISOString().split('T')[0])
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)
    setInvoiceDueDate(dueDate.toISOString().split('T')[0])
    setInvoiceNotes(quote.notes || '')
  }

  const submitConversionToInvoice = () => {
    if (!canConvertToInvoice) { alert('Permission manquante: quote_convert_to_invoice'); return }
    setConvertingToInvoice(true)
    router.post(route('quotes.convert-to-invoice', quote.id), {
      invoice_date: invoiceDate,
      invoice_due_date: invoiceDueDate,
      invoice_notes: invoiceNotes,
    }, {
      preserveScroll: true,
      onFinish: () => {
        setConvertingToInvoice(false)
        setConversionModalOpen(false)
      },
    })
  }

  const startStatusChange = (newStatus: QuoteStatus) => {
    if (!canChangeStatus) { alert('Permission manquante: quote_change_status'); return }
    setPendingStatus(newStatus)
    setComment('')
    setStatusMenuOpen(false)
    setCommentModalOpen(true)
  }

  const submitStatusChange = () => {
    if (!pendingStatus || !canChangeStatus) {
      if (!canChangeStatus) alert('Permission manquante: quote_change_status')
      return
    }
    setChangingStatus(true)
    router.post(
      route('quotes.change-status', quote.id),
      { status: pendingStatus, comment },
      {
        preserveScroll: true,
        onFinish: () => {
          setChangingStatus(false)
          setCommentModalOpen(false)
          setPendingStatus(null)
          setComment('')
        },
      },
    )
  }

  /* ------------------------------ Render --------------------------- */
  return (
    <>
      <Head title={`Devis – ${quote.quote_number}`} />

      <div className="relative min-h-screen flex flex-col bg-gradient-to-br
                   from-white via-slate-100 to-slate-200
                   dark:from-[#0a0420] dark:via-[#0e0a32] dark:to-[#1B1749]">
        <ParticlesBackground />

        <AppLayout
          breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Devis', href: '/quotes' },
            { title: quote.quote_number, href: route('quotes.show', quote.id) },
          ]}
        >
          {/* ===== En-tête ===== */}
          <div className="px-6 pt-6 pb-1">
            <Header
              quote={quote}
              totals={totals}
              fmt={fmt}
              statusLabel={statusLabel}
              statusColor={statusColor}
              exportPdf={exportPdf}
              duplicateQuote={duplicateQuote}
              transitions={transitions}
              statusMenuOpen={statusMenuOpen}
              setStatusMenuOpen={setStatusMenuOpen}
              startStatusChange={startStatusChange}
              convertToInvoice={openConversionModal}
              canEdit={canEdit}
              canExport={canExport}
              canDuplicate={canDuplicate}
              canChangeStatus={canChangeStatus}
              canConvertToInvoice={canConvertToInvoice}
            />
          </div>

          {/* ===== Contenu ===== */}
          <div className="flex-grow p-6 flex flex-col">
            <div className="flex-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl
                         grid grid-cols-1 md:grid-cols-4 min-h-[350px]">
              {/* Tabs */}
              <div className="border-r border-slate-200 dark:border-slate-700 flex flex-col">
                {(['details', 'items', 'notes', 'history'] as Tab[]).map(tab => (
                  <TabButton
                    key={tab}
                    tab={tab}
                    active={activeTab}
                    setActive={setActiveTab}
                  />
                ))}
              </div>

              {/* Panels */}
              <div className="p-6 md:col-span-3 overflow-y-auto text-slate-700 dark:text-slate-300">
                {activeTab === 'details' && (
                  <DetailsPanel
                    quote={quote}
                    totals={{ sub: totals.sub, tva: totals.tva }}
                    fmt={fmt}
                    statusLabel={statusLabel}
                    statusColor={statusColor}
                  />
                )}

                {activeTab === 'items' && (
                  <ItemsPanel
                    quote={quote}
                    fmt={fmt}
                    currencySym={currencySym}
                    totals={totals}
                  />
                )}

                {activeTab === 'notes' && (
                  <NotesPanel quote={quote} />
                )}

                {activeTab === 'history' && (
                  <HistoryPanel
                    histories={quote.status_histories ?? []}
                    statusLabel={statusLabel}
                  />
                )}
              </div>
            </div>
          </div>
        </AppLayout>
      </div>

      {/* ─────────── Modal Commentaire ─────────── */}
      {commentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Commentaire</h2>

            <textarea
              rows={4}
              className="w-full resize-none rounded border border-slate-300 dark:border-slate-600
                         bg-white/90 dark:bg-slate-900/30 p-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Ajouter un commentaire (optionnel)…"
              value={comment}
              onChange={e => setComment(e.target.value)}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setCommentModalOpen(false)}>
                Annuler
              </Button>
              <Button onClick={submitStatusChange} disabled={changingStatus}>
                {changingStatus && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Valider
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── Modal Conversion en Facture ─────────── */}
      {conversionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-500/10 rounded-lg">
                <FileCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Convertir en facture</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="invoice-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <CalendarDays className="inline w-4 h-4 mr-1" />
                  Date de la facture
                </label>
                <input
                  type="date"
                  id="invoice-date"
                  className="w-full rounded border border-slate-300 dark:border-slate-600
                             bg-white/90 dark:bg-slate-900/30 p-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="invoice-due-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <Clock className="inline w-4 h-4 mr-1" />
                  Date d'échéance
                </label>
                <input
                  type="date"
                  id="invoice-due-date"
                  className="w-full rounded border border-slate-300 dark:border-slate-600
                             bg-white/90 dark:bg-slate-900/30 p-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={invoiceDueDate}
                  onChange={e => setInvoiceDueDate(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="invoice-notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <FileText className="inline w-4 h-4 mr-1" />
                  Notes (optionnel)
                </label>
                <textarea
                  id="invoice-notes"
                  rows={4}
                  className="w-full resize-none rounded border border-slate-300 dark:border-slate-600
                             bg-white/90 dark:bg-slate-900/30 p-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Notes ou commentaires pour la facture..."
                  value={invoiceNotes}
                  onChange={e => setInvoiceNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                Résumé de la conversion
              </h3>
              <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                <div>• Client : {quote.client.company_name}</div>
                <div>• Devis : {quote.quote_number}</div>
                <div>• Total TTC : {fmt(totals.ttc)}</div>
                <div>• {quote.items.length} article{quote.items.length > 1 ? 's' : ''}</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={closeConversionModal}>
                Annuler
              </Button>
              <Button onClick={submitConversionToInvoice} disabled={convertingToInvoice}>
                {convertingToInvoice && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                <Receipt className="w-4 h-4 mr-2" />
                Créer la facture
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Sous-composants                                                    */
/* ------------------------------------------------------------------ */

/* ----------------------- HEADER ----------------------------------- */
const Header = ({
  quote,
  totals,
  fmt,
  statusLabel,
  statusColor,
  exportPdf,
  duplicateQuote,
  transitions,
  statusMenuOpen,
  setStatusMenuOpen,
  startStatusChange,
  convertToInvoice,
  canEdit,
  canExport,
  canDuplicate,
  canChangeStatus,
  canConvertToInvoice,
}: {
  quote: Quote
  totals: { sub: number; tva: number; ttc: number; disc: number }
  fmt: (n?: number | null) => string
  statusLabel: Record<QuoteStatus, string>
  statusColor: Record<QuoteStatus, 'red' | 'green' | 'secondary' | 'default'>
  exportPdf: () => void
  duplicateQuote: () => void
  transitions: Partial<Record<QuoteStatus, QuoteStatus[]>>
  statusMenuOpen: boolean
  setStatusMenuOpen: (b: boolean) => void
  startStatusChange: (s: QuoteStatus) => void
  convertToInvoice: () => void
  canEdit: boolean
  canExport: boolean
  canDuplicate: boolean
  canChangeStatus: boolean
  canConvertToInvoice: boolean
}) => {
  const ttcDisplay = isFinite(Number(quote.total_ttc))
    ? Number(quote.total_ttc)
    : (totals.ttc ?? (totals.sub + totals.tva))

  const hasDiscount = Number(quote.discount_total ?? totals.disc ?? 0) > 0
  const ttcLabel = `TTC : ${fmt(ttcDisplay)}${hasDiscount ? ' – Après remise' : ''}`

  return (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700
                 backdrop-blur-md p-6 rounded-xl shadow-xl flex flex-col lg:flex-row gap-6 items-start">
      <div className="w-32 h-32 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
        <FileText className="w-12 h-12 text-slate-400" />
      </div>

      <div className="flex-1 space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {quote.quote_number}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {quote.client.company_name}
          {quote.client.contact_name && ` – ${quote.client.contact_name}`}
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Calendar className="w-4 h-4" />{' '}
          {new Date(quote.quote_date).toLocaleDateString('fr-FR')} •{' '}
          <Clock className="w-4 h-4" /> Valide jusqu'au{' '}
          {new Date(quote.valid_until).toLocaleDateString('fr-FR')}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge text={statusLabel[quote.status]} color={statusColor[quote.status]} />
          <Badge text={ttcLabel} color="default" />
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full sm:w-auto">
        <Link href={route('quotes.index')} className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour
          </Button>
        </Link>

        {canEdit && (
          <Link href={route('quotes.edit', quote.id)} className="w-full sm:w-auto">
            <Button className="group flex items-center justify-center rounded-lg bg-gradient-to-r from-red-600 to-red-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-red-500 hover:to-red-600">
              <Pencil className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          </Link>
        )}

        {canExport && (
          <Button variant="secondary" className="w-full sm:w-auto" onClick={exportPdf}>
            <Download className="w-4 h-4 mr-2" />
            Exporter&nbsp;PDF
          </Button>
        )}

        {canDuplicate && (
          <Button variant="secondary" className="w-full sm:w-auto" onClick={duplicateQuote}>
            <CopyPlus className="w-4 h-4 mr-2" />
            Dupliquer
          </Button>
        )}

        {canConvertToInvoice && (
          <Button variant="secondary" className="w-full sm:w-auto" onClick={convertToInvoice}>
            <Receipt className="w-4 h-4 mr-2" />
            Convertir en facture
          </Button>
        )}

        {transitions[quote.status]?.length ? (
          <div className="relative">
            <Button
              variant="outline"
              className="w-full sm:w-auto flex items-center justify-between"
              onClick={() => setStatusMenuOpen(!statusMenuOpen)}
            >
              Changer&nbsp;statut
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>

            {statusMenuOpen && (
              <ul className="absolute z-50 mt-1 w-44 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                {transitions[quote.status]!.map(s => (
                  <li key={s}>
                    <button
                      onClick={() => startStatusChange(s)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                      {statusLabel[s]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* -------------------- PANEL — Détails ----------------------------- */
const DetailsPanel = ({
  quote,
  totals,
  fmt,
  statusLabel,
  statusColor,
}: {
  quote: Quote
  totals: { sub: number; tva: number }
  fmt: (n?: number | null) => string
  statusLabel: Record<QuoteStatus, string>
  statusColor: Record<QuoteStatus, 'red' | 'green' | 'secondary' | 'default'>
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
    <Detail icon={Building2} label="Client"          value={quote.client.company_name} />
    <Detail icon={Calendar}  label="Date devis"      value={new Date(quote.quote_date).toLocaleDateString('fr-FR')} />
    <Detail icon={Calendar}  label="Valide jusqu'au" value={new Date(quote.valid_until).toLocaleDateString('fr-FR')} />
    <Detail
      icon={Receipt}
      label="Statut"
      value={<Badge text={statusLabel[quote.status]} color={statusColor[quote.status]} />}
    />
    <Detail icon={FileText} label="Nombre d'articles" value={quote.items.length} />
    <Detail icon={Shield}   label="Total TTC"         value={fmt((quote.total_ttc ?? NaN) || (totals.sub + totals.tva))} />
  </div>
)

/* -------------------- PANEL — Articles (sans colonne TVA %) ------- */
const ItemsPanel = ({
  quote,
  fmt,
  currencySym,
  totals,
}: {
  quote: Quote
  fmt: (n?: number | null) => string
  currencySym: string
  totals: { sub:number; tva:number; ttc:number; disc:number }
}) => {
  const rows = (quote.items || []).map(it => {
    const unit = Number(it.unit_price_ht_snapshot ?? it.unit_price_ht ?? 0)
    const qty  = Number(it.quantity ?? 0)
    const ht   = Number(it.line_total_ht ?? unit * qty)
    const tax  = Number(it.line_tax_amount ?? ((it.tax_rate_snapshot ?? it.tax_rate ?? 0) as number) * (unit * qty) / 100)
    const ttc  = Number(it.line_total_ttc ?? (ht + tax))
    const disc = Number(it.discount_amount ?? 0)
    const ttcAfter = Math.max(0, ttc - disc)
    return { ...it, unit, qty, ht, tax, ttc, disc, ttcAfter }
  })

  const subHT   = rows.reduce((s, r) => s + r.ht, 0)
  const tvatot  = rows.reduce((s, r) => s + r.tax, 0)
  const ttcRaw  = rows.reduce((s, r) => s + r.ttc, 0)
  const discTot = rows.reduce((s, r) => s + r.disc, 0)
  const ttcNet  = Math.max(0, ttcRaw - discTot)

  const promos = quote.applied_promotions || []

  const promoLabel = (p: AppliedPromotion) => {
    if (p?.hint?.type === 'percent') {
      return `${p.name} (${Number(p.hint.value)}%)`
    }
    if (p?.hint?.type === 'fixed') {
      // affichage compact "50 MAD"
      return `${p.name} (${Number(p.hint.value)} ${currencySym})`
    }
    // fallback si jamais hint absent
    return `${p.name}`
  }

  return rows.length ? (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left bg-slate-50 dark:bg-slate-700/30">
              <th className="px-3 py-2">Désignation</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2 text-right">Qté</th>
              <th className="px-3 py-2 text-right">PU&nbsp;HT</th>
              <th className="px-3 py-2 text-right">Total&nbsp;HT</th>
              <th className="px-3 py-2 text-right">Remise</th>
              <th className="px-3 py-2 text-right">TTC&nbsp;après remise</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-slate-200 dark:border-slate-700 last:border-0">
                <td className="px-3 py-2">{r.product_name_snapshot || r.product?.name}</td>
                <td className="px-3 py-2">{r.product_sku_snapshot  || r.product?.sku}</td>
                <td className="px-3 py-2 text-right">{r.qty}</td>
                <td className="px-3 py-2 text-right">{fmt(r.unit)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.ht)}</td>
                <td className="px-3 py-2 text-right text-green-600">{r.disc > 0 ? `- ${fmt(r.disc)}` : '—'}</td>
                <td className="px-3 py-2 text-right font-medium">{fmt(r.ttcAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totaux + Promotions */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bloc promotions appliquées (affiche la valeur de base) */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-red-600" />
            Promotions appliquées
          </h3>
          {promos.length ? (
            <ul className="space-y-1">
              {promos.map((p, idx) => (
                <li key={`${p.promotion_id}-${idx}`} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{promoLabel(p)}</span>
                  {/* On garde à droite le montant calculé (utile visuellement) */}
                  <span className="text-green-600">- {fmt(p.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Aucune promotion.</p>
          )}
        </div>

        {/* Bloc totaux chiffrés */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold mb-3">Totaux</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Sous-total HT :</span>
              <span className="font-medium">
                {fmt(isFinite(quote.subtotal_ht as any) ? quote.subtotal_ht : subHT)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>TVA :</span>
              <span className="font-medium">
                {fmt(isFinite(quote.total_tax as any) ? quote.total_tax : tvatot)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total TTC (avant remises) :</span>
              <span className="font-medium">{fmt(ttcRaw)}</span>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-2" />

            <div className="flex justify-between text-green-700">
              <span>Remise totale :</span>
              <span className="font-bold">- {fmt(isFinite(quote.discount_total as any) ? quote.discount_total : discTot)}</span>
            </div>

            <div className="flex justify-between text-lg font-bold">
              <span>Total TTC après remise :</span>
              <span>
                {fmt(isFinite(quote.total_ttc as any) ? quote.total_ttc : ttcNet)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  ) : (
    <p className="text-slate-500 dark:text-slate-400 italic">Aucun article.</p>
  )
}

/* -------------------- PANEL — Notes ------------------------------- */
const NotesPanel = ({ quote }: { quote: Quote }) => (
  <>
    {quote.terms_conditions || quote.notes || quote.internal_notes ? (
      <div className="space-y-6">
        {quote.terms_conditions && (
          <Section title="Conditions générales" content={quote.terms_conditions} />
        )}
        {quote.notes && <Section title="Notes client" content={quote.notes} />}
        {quote.internal_notes && (
          <Section title="Notes internes" content={quote.internal_notes} />
        )}
      </div>
    ) : (
      <p className="text-slate-500 dark:text-slate-400 italic">Aucune note.</p>
    )}
  </>
)

/* -------------------- PANEL — Historique -------------------------- */
const HistoryPanel = ({
  histories,
  statusLabel,
}: {
  histories: QuoteStatusHistory[]
  statusLabel: Record<QuoteStatus, string>
}) => (
  histories.length ? (
    <ul className="space-y-4">
      {histories.map((h, idx) => (
        <li key={idx} className="text-sm border-b border-slate-200 dark:border-slate-700 pb-2">
          <div className="font-medium">
            {(h.from_status ? statusLabel[h.from_status] : 'Nouveau')}
            {' → '}
            {statusLabel[h.to_status]}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {h.user?.name ?? 'Système'} •{' '}
            {new Date(h.created_at).toLocaleString('fr-FR')}
          </div>
          {h.comment && (
            <div className="mt-1 italic text-slate-600 dark:text-slate-300">
              {h.comment}
            </div>
          )}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-slate-500 dark:text-slate-400 italic">
      Aucun changement de statut.
    </p>
  )
)

/* ------------------------------------------------------------------ */
/* Petits helpers UI                                                  */
/* ------------------------------------------------------------------ */
const Badge = ({
  text,
  color,
}: {
  text: string
  color: 'red' | 'green' | 'secondary' | 'default'
}) => (
  <span
    className={`inline-block px-2 py-1 text-xs rounded-full font-medium select-none tracking-wide
      ${
        color === 'red'
          ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
          : color === 'green'
          ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
          : 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400'
      }`}
  >
    {text}
  </span>
)

const Detail = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Info
  label: string
  value: React.ReactNode
}) => (
  <div className="flex items-start gap-3">
    <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500 mt-1" />
    <div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-900 dark:text-white/90 break-all">
        {value}
      </div>
    </div>
  </div>
)

const TabButton = ({
  tab,
  active,
  setActive,
}: {
  tab: Tab
  active: Tab
  setActive: (t: Tab) => void
}) => {
  const icons: Record<Tab, JSX.Element> = {
    details: <Info    className="inline w-4 h-4 mr-2" />,
    items:   <Package className="inline w-4 h-4 mr-2" />,
    notes:   <FileText className="inline w-4 h-4 mr-2" />,
    history: <Clock   className="inline w-4 h-4 mr-2" />,
  }
  const labels: Record<Tab, string> = {
    details: 'Détails',
    items  : 'Articles',
    notes  : 'Notes',
    history: 'Historique',
  }
  const isActive = active === tab
  return (
    <button
      onClick={() => setActive(tab)}
      className={`w-full px-4 py-3 text-left text-sm font-medium transition flex items-center
        ${
          isActive
            ? 'bg-gradient-to-r from-red-600 to-red-500 text-white rounded-l-xl shadow-inner'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white'
        }`}
    >
      {icons[tab]} {labels[tab]}
    </button>
  )
}

const Section = ({ title, content }: { title: string; content: string }) => (
  <div>
    <h3 className="font-semibold text-slate-900 dark:text-white mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">
      {title}
    </h3>
    <p className="whitespace-pre-line text-sm">{content}</p>
  </div>
)
