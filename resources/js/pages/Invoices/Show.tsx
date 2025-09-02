/* ------------------------------------------------------------------ */
/* Show.tsx — Factures / Invoice (avec permissions alignées Index)    */
/* ------------------------------------------------------------------ */
import React, { useMemo, useState, useCallback } from 'react'
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
  Send,
  CreditCard,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
} from 'lucide-react'

import AppLayout           from '@/layouts/app-layout'
import ParticlesBackground from '@/components/ParticlesBackground'
import { Button }          from '@/components/ui/button'

/* ------------------------------ Permissions ------------------------------ */
const useCan = () => {
  const { props } = usePage<{ auth?: { roles?: string[]; permissions?: string[] } }>()
  const roles = props.auth?.roles ?? []
  const perms = props.auth?.permissions ?? []
  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('super-admin')
  const set = React.useMemo(() => new Set(perms), [perms.join(',')])
  const can = (p?: string) => !p || isSuperAdmin || set.has(p)
  return { can, isSuperAdmin }
}

/* ------------------------------------------------------------------ */
/* Types & Props                                                      */
/* ------------------------------------------------------------------ */
type Tab = 'details' | 'items' | 'notes' | 'history'

/** ⚠️ Aligné sur le backend (Invoice.php / Controller) */
type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'issued'
  | 'paid'
  | 'partially_paid'
  | 'cancelled'
  | 'refunded'

interface InvoiceItem {
  id                     : number
  product_name_snapshot  : string
  product_sku_snapshot   : string
  quantity               : number
  unit_price_ht_snapshot : number | null
  tax_rate_snapshot      : number | null
  /** Fallbacks injectés côté backend */
  unit_price_ht?         : number | null
  tax_rate?              : number | null
  product?               : { name: string; sku: string } | null
}

interface InvoiceStatusHistory {
  from_status: InvoiceStatus | null
  to_status  : InvoiceStatus
  comment?   : string
  created_at : string
  user?      : { name: string } | null
}

interface Invoice {
  id              : number | string
  invoice_number  : string
  status          : InvoiceStatus
  invoice_date    : string
  due_date        : string | null
  currency_code   : string
  currency_symbol?: string
  client          : { id: number | string; company_name: string; contact_name?: string | null }
  items           : InvoiceItem[]
  terms_conditions?: string | null
  notes?          : string | null
  internal_notes? : string | null
  /** Clé snake_case renvoyée par Laravel */
  status_histories?: InvoiceStatusHistory[]
  /** État dérivé renvoyé par le BE */
  is_overdue?     : boolean
}

interface Props {
  invoice: Invoice
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */
export default function InvoiceShow({ invoice }: Props) {
  /* ───────── permissions ───────── */
  const { can } = useCan()

  /* ───────── state pour les onglets et menus ───────── */
  const [activeTab,        setActiveTab]        = useState<Tab>('details')
  const [statusMenuOpen,   setStatusMenuOpen]   = useState(false)

  /* ───────── state pour le commentaire ───────── */
  const [commentModalOpen, setCommentModalOpen] = useState(false)
  const [pendingStatus,    setPendingStatus]    = useState<InvoiceStatus | null>(null)
  const [pendingAction,    setPendingAction]    = useState<'status' | 'reopen' | 'send' | 'mark-paid' | null>(null)
  const [comment,          setComment]          = useState('')
  const [changingStatus,   setChangingStatus]   = useState(false)

  /* ----------------------------- Helpers --------------------------- */
  const statusLabel: Record<InvoiceStatus, string> = {
    draft         : 'Brouillon',
    sent          : 'Envoyée',
    issued        : 'Émise',
    paid          : 'Payée',
    partially_paid: 'Partiellement payée',
    cancelled     : 'Annulée',
    refunded      : 'Remboursée',
  }

  const statusColor: Record<
    InvoiceStatus,
    'red' | 'green' | 'secondary' | 'default' | 'orange'
  > = {
    draft         : 'secondary',
    sent          : 'default',
    issued        : 'default',
    paid          : 'green',
    partially_paid: 'orange',
    cancelled     : 'secondary',
    refunded      : 'red',
  }

  /** ⚠️ Transitions strictement alignées sur InvoiceController::changeStatus() */
  const transitions: Partial<Record<InvoiceStatus, InvoiceStatus[]>> = {
    draft         : ['sent', 'issued', 'cancelled'],
    sent          : ['issued', 'paid', 'partially_paid', 'cancelled'],
    issued        : ['paid', 'partially_paid', 'cancelled'],
    partially_paid: ['paid', 'cancelled'],
    paid          : ['refunded'],
    cancelled     : [],
    refunded      : [],
  }

  /* --------- Formatter numéraire ---------------------------------- */
  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  )

  const currency = invoice.currency_symbol || invoice.currency_code
  const fmt = useCallback(
    (n?: number | string | null) => {
      const num = Number(n)           // "100.00" → 100
      return !isFinite(num)
        ? '-'                         // null, undefined ou NaN
        : `${numberFormatter.format(num)} ${currency}`
    },
    [numberFormatter, currency],
  )

  /* ------ Totaux --------------------------------------------------- */
  const totals = useMemo(() => {
    return invoice.items.reduce(
      (acc, it) => {
        const unit = it.unit_price_ht_snapshot ?? it.unit_price_ht ?? 0
        const ht   = unit * it.quantity
        const tax  = ht * (it.tax_rate_snapshot ?? it.tax_rate ?? 0) / 100
        return { sub: acc.sub + ht, tva: acc.tva + tax }
      },
      { sub: 0, tva: 0 },
    )
  }, [invoice.items])

  /* ------------------------- Actions (avec permissions) ------------ */
  const exportPdf = () => {
    if (!can('invoice_export')) return alert('Permission manquante: invoice_export')
    window.open(route('invoices.export-pdf', invoice.id), '_blank', 'noopener')
  }

  const duplicateInvoice = () => {
    if (!(can('invoice_duplicate') || can('invoice_create')))
      return alert('Permission manquante: invoice_duplicate')
    router.post(route('invoices.duplicate', invoice.id))
  }

  const sendReminder = () => {
    if (!can('invoice_send_reminder')) return alert('Permission manquante: invoice_send_reminder')
    if (!confirm('Envoyer un rappel de paiement au client ?')) return
    router.post(route('invoices.send-reminder', invoice.id), {}, {
      preserveScroll: true,
    })
  }

  /* → Actions modifiées pour utiliser la popup */
  const startSend = () => {
    if (!can('invoice_send')) return alert('Permission manquante: invoice_send')
    setPendingAction('send')
    setComment('')
    setCommentModalOpen(true)
  }

  const startMarkAsPaid = () => {
    if (!can('invoice_mark_paid')) return alert('Permission manquante: invoice_mark_paid')
    setPendingAction('mark-paid')
    setComment('')
    setCommentModalOpen(true)
  }

  const startReopen = () => {
    if (!can('invoice_reopen')) return alert('Permission manquante: invoice_reopen')
    setPendingAction('reopen')
    setComment('')
    setCommentModalOpen(true)
  }

  /* → 1. L'utilisateur choisit un nouveau statut */
  const startStatusChange = (newStatus: InvoiceStatus) => {
    if (!can('invoice_change_status')) return alert('Permission manquante: invoice_change_status')
    setPendingStatus(newStatus)
    setPendingAction('status')
    setComment('')
    setStatusMenuOpen(false)
    setCommentModalOpen(true)
  }

  /* → 2. Il valide le commentaire */
  const submitAction = () => {
    setChangingStatus(true)

    // mapping action -> permission
    const needs: Record<NonNullable<typeof pendingAction>, string> = {
      'reopen'    : 'invoice_reopen',
      'send'      : 'invoice_send',
      'mark-paid' : 'invoice_mark_paid',
      'status'    : 'invoice_change_status',
    } as const

    if (pendingAction && !can(needs[pendingAction])) {
      setChangingStatus(false)
      return alert(`Permission manquante: ${needs[pendingAction]}`)
    }

    if (pendingAction === 'reopen') {
      router.post(
        route('invoices.reopen', invoice.id),
        { comment },
        {
          preserveScroll: true,
          onFinish: () => {
            setChangingStatus(false)
            setCommentModalOpen(false)
            setPendingAction(null)
            setComment('')
          },
        },
      )
    } else if (pendingAction === 'send') {
      router.post(
        route('invoices.send', invoice.id),
        { comment },
        {
          preserveScroll: true,
          onFinish: () => {
            setChangingStatus(false)
            setCommentModalOpen(false)
            setPendingAction(null)
            setComment('')
          },
        },
      )
    } else if (pendingAction === 'mark-paid') {
      router.post(
        route('invoices.mark-paid', invoice.id),
        { comment },
        {
          preserveScroll: true,
          onFinish: () => {
            setChangingStatus(false)
            setCommentModalOpen(false)
            setPendingAction(null)
            setComment('')
          },
        },
      )
    } else if (pendingAction === 'status' && pendingStatus) {
      router.post(
        route('invoices.change-status', invoice.id),
        { status: pendingStatus, comment },
        {
          preserveScroll: true,
          onFinish: () => {
            setChangingStatus(false)
            setCommentModalOpen(false)
            setPendingStatus(null)
            setPendingAction(null)
            setComment('')
          },
        },
      )
    }
  }

  /* → Fonction pour obtenir le titre et placeholder du modal */
  const getModalContent = () => {
    switch (pendingAction) {
      case 'reopen':
        return {
          title: 'Réouvrir la facture',
          placeholder: 'Raison de la réouverture (optionnel)…',
          action: 'Réouvrir'
        }
      case 'send':
        return {
          title: 'Envoyer la facture',
          placeholder: 'Commentaire sur l\'envoi (optionnel)…',
          action: 'Envoyer'
        }
      case 'mark-paid':
        return {
          title: 'Marquer comme payée',
          placeholder: 'Commentaire sur le paiement (optionnel)…',
          action: 'Marquer payée'
        }
      case 'status':
        return {
          title: 'Changer le statut',
          placeholder: 'Ajouter un commentaire (optionnel)…',
          action: 'Valider'
        }
      default:
        return {
          title: 'Commentaire',
          placeholder: 'Ajouter un commentaire (optionnel)…',
          action: 'Valider'
        }
    }
  }

  /* ------------------------------ Render --------------------------- */
  return (
    <>
      <Head title={`Facture – ${invoice.invoice_number}`} />

      <div className="relative min-h-screen flex flex-col bg-gradient-to-br
                   from-white via-slate-100 to-slate-200
                   dark:from-[#0a0420] dark:via-[#0e0a32] dark:to-[#1B1749]">
        <ParticlesBackground />

        <AppLayout
          breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Factures', href: '/invoices' },
            { title: invoice.invoice_number, href: route('invoices.show', invoice.id) },
          ]}
        >
          {/* ===== En-tête ===== */}
          <div className="px-6 pt-6 pb-1">
            <Header
              invoice={invoice}
              totals={totals}
              fmt={fmt}
              statusLabel={statusLabel}
              statusColor={statusColor}
              exportPdf={exportPdf}
              duplicateInvoice={duplicateInvoice}
              startSend={startSend}
              startMarkAsPaid={startMarkAsPaid}
              sendReminder={sendReminder}
              startReopen={startReopen}
              transitions={transitions}
              statusMenuOpen={statusMenuOpen}
              setStatusMenuOpen={setStatusMenuOpen}
              startStatusChange={startStatusChange}
              can={can}
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
                    invoice={invoice}
                    totals={totals}
                    fmt={fmt}
                    statusLabel={statusLabel}
                    statusColor={statusColor}
                  />
                )}

                {activeTab === 'items' && (
                  <ItemsPanel invoice={invoice} fmt={fmt} />
                )}

                {activeTab === 'notes' && (
                  <NotesPanel invoice={invoice} />
                )}

                {activeTab === 'history' && (
                  <HistoryPanel
                    histories={invoice.status_histories ?? []}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center
                     bg-black/50 backdrop-blur-sm"
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-800
                       border border-slate-200 dark:border-slate-700
                       rounded-lg p-6 space-y-4"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {getModalContent().title}
            </h2>

            <textarea
              rows={4}
              className="w-full resize-none rounded border border-slate-300 dark:border-slate-600
                         bg-white/90 dark:bg-slate-900/30 p-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder={getModalContent().placeholder}
              value={comment}
              onChange={e => setComment(e.target.value)}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setCommentModalOpen(false)}>
                Annuler
              </Button>
              <Button onClick={submitAction} disabled={changingStatus}>
                {changingStatus && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {getModalContent().action}
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
  invoice,
  totals,
  fmt,
  statusLabel,
  statusColor,
  exportPdf,
  duplicateInvoice,
  startSend,
  startMarkAsPaid,
  sendReminder,
  startReopen,
  transitions,
  statusMenuOpen,
  setStatusMenuOpen,
  startStatusChange,
  can,
}: {
  invoice: Invoice
  totals: { sub: number; tva: number }
  fmt: (n?: number | null) => string
  statusLabel: Record<InvoiceStatus, string>
  statusColor: Record<InvoiceStatus, 'red' | 'green' | 'secondary' | 'default' | 'orange'>
  exportPdf: () => void
  duplicateInvoice: () => void
  startSend: () => void
  startMarkAsPaid: () => void
  sendReminder: () => void
  startReopen: () => void
  transitions: Partial<Record<InvoiceStatus, InvoiceStatus[]>>
  statusMenuOpen: boolean
  setStatusMenuOpen: (b: boolean) => void
  startStatusChange: (s: InvoiceStatus) => void
  can: (perm?: string) => boolean
}) => {
  const hasAnyAction =
    (invoice.status === 'draft' && can('invoice_edit')) ||
    can('invoice_export') ||
    (can('invoice_duplicate') || can('invoice_create')) ||
    ((['draft','cancelled'].includes(invoice.status)) && can('invoice_send')) ||
    ((['sent','issued','partially_paid'].includes(invoice.status) || !!invoice.is_overdue) && can('invoice_mark_paid')) ||
    (!!invoice.is_overdue && can('invoice_send_reminder')) ||
    (invoice.status === 'paid' && can('invoice_change_status')) ||
    (invoice.status === 'refunded' && can('invoice_reopen')) ||
    (can('invoice_change_status') && (transitions[invoice.status]?.length ?? 0) > 0)

  return (
  <div
    className="bg-white dark:bg:white/5 dark:bg-white/5 border border-slate-200 dark:border-slate-700
               backdrop-blur-md p-6 rounded-xl shadow-xl flex flex-col lg:flex-row gap-6 items-start"
  >
    {/* Icône */}
    <div className="w-32 h-32 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
      <Receipt className="w-12 h-12 text-slate-400" />
    </div>

    {/* Infos */}
    <div className="flex-1 space-y-2">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        {invoice.invoice_number}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {invoice.client.company_name}
        {invoice.client.contact_name && ` – ${invoice.client.contact_name}`}
      </p>
      <p className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
        <Calendar className="w-4 h-4" />{' '}
        {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('fr-FR') : '-'} •{' '}
        <Clock className="w-4 h-4" /> Échéance le{' '}
        {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-FR') : '-'}
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <Badge
          text={statusLabel[invoice.status]}
          color={statusColor[invoice.status]}
        />
        {invoice.is_overdue && <Badge text="En retard" color="red" />}
        <Badge text={`TTC : ${fmt(totals.sub + totals.tva)}`} color="default" />
      </div>
    </div>

    {/* Actions */}
    {hasAnyAction && (
    <div className="flex flex-col gap-2 w-full sm:w-auto">
      <Link href={route('invoices.index')} className="w-full sm:w-auto">
        <Button variant="outline" className="w-full sm:w-auto">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
      </Link>

      {/* Edit (brouillon uniquement) */}
      {invoice.status === 'draft' && can('invoice_edit') && (
        <Link href={route('invoices.edit', invoice.id)} className="w-full sm:w-auto">
          <Button
            className="group flex items-center justify-center
                       rounded-lg bg-gradient-to-r from-red-600 to-red-500 px-5 py-3
                       text-sm font-semibold text-white shadow-md transition-all
                       hover:from-red-500 hover:to-red-600"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Modifier
          </Button>
        </Link>
      )}

      {/* Export PDF */}
      {can('invoice_export') && (
        <Button variant="secondary" className="w-full sm:w-auto" onClick={exportPdf}>
          <Download className="w-4 h-4 mr-2" />
          Exporter&nbsp;PDF
        </Button>
      )}

      {/* Dupliquer */}
      {(can('invoice_duplicate') || can('invoice_create')) && (
        <Button variant="secondary" className="w-full sm:w-auto" onClick={duplicateInvoice}>
          <CopyPlus className="w-4 h-4 mr-2" />
          Dupliquer
        </Button>
      )}

      {/* Envoyer (draft|cancelled) */}
      {(invoice.status === 'draft' || invoice.status === 'cancelled') && can('invoice_send') && (
        <Button
          variant="secondary" className="w-full sm:w-auto"
          onClick={startSend}
        >
          <Send className="w-4 h-4 mr-2" />
          Envoyer
        </Button>
      )}

      {/* Marquer payée */}
      {(['sent', 'issued', 'partially_paid'].includes(invoice.status) || !!invoice.is_overdue) && can('invoice_mark_paid') && (
        <Button
          variant="secondary" className="w-full sm:w-auto"
          onClick={startMarkAsPaid}
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Marquer payée
        </Button>
      )}

      {/* Rappel paiement */}
      {!!invoice.is_overdue && can('invoice_send_reminder') && (
        <Button
          variant="secondary" className="w-full sm:w-auto"
          onClick={sendReminder}
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Rappel paiement
        </Button>
      )}

      {/* Rembourser (paid → refunded) */}
      {invoice.status === 'paid' && can('invoice_change_status') && (
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={() => startStatusChange('refunded')}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Rembourser
        </Button>
      )}

      {/* Réouvrir (refunded → draft) */}
      {invoice.status === 'refunded' && can('invoice_reopen') && (
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={startReopen}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Réouvrir
        </Button>
      )}

      {/* Menu Changer statut (options dynamiques alignées BE) */}
      {can('invoice_change_status') && transitions[invoice.status]?.length ? (
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
            <ul
              className="absolute z-50 mt-1 w-52 right-0 bg-white dark:bg-slate-800
                         border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden"
            >
              {transitions[invoice.status]!.map(s => (
                <li key={s}>
                  <button
                    onClick={() => startStatusChange(s)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100
                               dark:hover:bg-slate-700 flex items-center gap-2"
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
    )}
  </div>
)}
/* -------------------- PANEL — Détails ----------------------------- */
const DetailsPanel = ({
  invoice,
  totals,
  fmt,
  statusLabel,
  statusColor,
}: {
  invoice: Invoice
  totals: { sub: number; tva: number }
  fmt: (n?: number | null) => string
  statusLabel: Record<InvoiceStatus, string>
  statusColor: Record<InvoiceStatus, 'red' | 'green' | 'secondary' | 'default' | 'orange'>
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
    <Detail icon={Building2} label="Client"           value={invoice.client.company_name} />
    <Detail icon={Calendar}  label="Date facture"     value={invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('fr-FR') : '-'} />
    <Detail icon={Calendar}  label="Date d'échéance"  value={invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-FR') : '-'} />
    <Detail
      icon={Receipt}
      label="Statut"
      value={
        <div className="flex items-center gap-2">
          <Badge text={statusLabel[invoice.status]} color={statusColor[invoice.status]} />
          {invoice.is_overdue && <Badge text="En retard" color="red" />}
        </div>
      }
    />
    <Detail icon={FileText} label="Nombre d'articles" value={invoice.items.length} />
    <Detail icon={Shield}   label="Total TTC"         value={fmt(totals.sub + totals.tva)} />
  </div>
)

/* -------------------- PANEL — Articles ---------------------------- */
const ItemsPanel = ({
  invoice,
  fmt,
}: {
  invoice: Invoice
  fmt: (n?: number | null) => string
}) => {
  const rows = invoice.items.map(it => {
    const unit = it.unit_price_ht_snapshot ?? it.unit_price_ht ?? 0
    const ht   = unit * it.quantity
    const tax  = ht * (it.tax_rate_snapshot ?? it.tax_rate ?? 0) / 100
    const ttc  = ht + tax
    return { ...it, unit, ht, tax, ttc }
  })

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
              <th className="px-3 py-2 text-right">TVA&nbsp;%</th>
              <th className="px-3 py-2 text-right">Total&nbsp;HT</th>
              <th className="px-3 py-2 text-right">Total&nbsp;TTC</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.id}
                className="border-b border-slate-200 dark:border-slate-700 last:border-0"
              >
                <td className="px-3 py-2">{r.product_name_snapshot || r.product?.name}</td>
                <td className="px-3 py-2">{r.product_sku_snapshot  || r.product?.sku}</td>
                <td className="px-3 py-2 text-right">{r.quantity}</td>
                <td className="px-3 py-2 text-right">{fmt(r.unit)}</td>
                <td className="px-3 py-2 text-right">{r.tax_rate_snapshot ?? r.tax_rate ?? 0}</td>
                <td className="px-3 py-2 text-right">{fmt(r.ht)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.ttc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totaux */}
      <div className="mt-4 text-right space-y-1">
        <div className="text-sm">
          Sous-total&nbsp;HT&nbsp;:{' '}
          <span className="font-medium">
            {fmt(rows.reduce((s, r) => s + r.ht, 0))}
          </span>
        </div>
        <div className="text-sm">
          TVA&nbsp;:{' '}
          <span className="font-medium">
            {fmt(rows.reduce((s, r) => s + r.tax, 0))}
          </span>
        </div>
        <div className="text-lg font-bold">
          Total&nbsp;TTC&nbsp;:{' '}
          {fmt(rows.reduce((s, r) => s + r.ttc, 0))}
        </div>
      </div>
    </>
  ) : (
    <p className="text-slate-500 dark:text-slate-400 italic">Aucun article.</p>
  )
}

/* -------------------- PANEL — Notes ------------------------------- */
const NotesPanel = ({ invoice }: { invoice: Invoice }) => (
  <>
    {invoice.terms_conditions || invoice.notes || invoice.internal_notes ? (
      <div className="space-y-6">
        {invoice.terms_conditions && (
          <Section title="Conditions générales" content={invoice.terms_conditions} />
        )}
        {invoice.notes && <Section title="Notes client" content={invoice.notes} />}
        {invoice.internal_notes && (
          <Section title="Notes internes" content={invoice.internal_notes} />
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
  histories: InvoiceStatusHistory[]
  statusLabel: Record<InvoiceStatus, string>
}) => (
  histories.length ? (
    <ul className="space-y-4">
      {histories.map((h, idx) => (
        <li
          key={idx}
          className="text-sm border-b border-slate-200 dark:border-slate-700 pb-2"
        >
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
  color: 'red' | 'green' | 'secondary' | 'default' | 'orange'
}) => (
  <span
    className={`inline-block px-2 py-1 text-xs rounded-full font-medium select-none tracking-wide
      ${
        color === 'red'
          ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
          : color === 'green'
          ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
          : color === 'orange'
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400'
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
    items:   'Articles',
    notes:   'Notes',
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
