import React, { useEffect, useMemo, useState } from 'react'
import { Head, router, usePage, Link } from '@inertiajs/react'
import { route } from 'ziggy-js'
import toast from 'react-hot-toast'

import AppLayout from '@/layouts/app-layout'
import ParticlesBackground from '@/components/ParticlesBackground'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

import {
  Plus, Search, Filter, CheckCircle, MoreHorizontal,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Trash2, Edit2, X, SlidersHorizontal, Percent as PercentIcon,
  Calendar, Tag, Shield, Power, AlertTriangle,
} from 'lucide-react'

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */
type Pagination<T> = {
  data: T[]
  current_page: number
  last_page: number
  total: number
  per_page: number
  from: number
  to: number
}

type PromotionRow = {
  id: number
  name: string
  description?: string | null
  type: 'order'|'category'|'product'|'bogo'
  apply_scope: 'order'|'category'|'product'
  is_active: boolean
  is_exclusive: boolean
  priority: number
  starts_at?: string|null
  ends_at?: string|null
  // ⬇️ backend renvoie souvent decimal en string (ou null) → on l’autorise
  actions?: { id:number; action_type:'percent'|'fixed'; value:number|string|null }[]
  codes?: { id:number; code:string }[]
  deleted_at?: string | null
}

type Filters = {
  search?: string
  type?: ''|'order'|'category'|'product'|'bogo'
  active?: ''|'1'|'0'
}

type Flash = { success?: string; error?: string }

type Props = {
  promotions: Pagination<PromotionRow>
  filters: Filters
  flash?: Flash
}

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

/* -------------------------------------------------------------------------- */
/*                                COMPONENT                                   */
/* -------------------------------------------------------------------------- */
import PromotionForm from './partials/PromotionForm'

export default function PromotionsIndex({ promotions: raw, filters, flash }: Props) {
  const { can } = useCan()

  /* ----------------------- Pagination safe destructuring ---------------------- */
  const {
    data: rows = [],
    current_page = 1,
    last_page = 1,
    from = 0,
    to = 0,
    total = 0,
    per_page = 15,
  } = raw ?? { data: [] }

  /* ------------------------------ UI STATE ----------------------------------- */
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [searchVal, setSearchVal] = useState(filters.search ?? '')
  const [typeVal, setTypeVal] = useState<Filters['type']>(filters.type ?? '')
  const [activeVal, setActiveVal] = useState<Filters['active']>(filters.active ?? '')
  const [showSuccess, setShowSuccess] = useState(!!flash?.success)
  const [showError, setShowError] = useState(!!flash?.error)

  // Modal d’édition uniquement
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PromotionRow|null>(null)

  /* ------------------------------ FLASH --------------------------------- */
  useEffect(() => {
    if (flash?.success) {
      setShowSuccess(true)
      const t = setTimeout(() => setShowSuccess(false), 5000)
      return () => clearTimeout(t)
    }
  }, [flash?.success])

  useEffect(() => {
    if (flash?.error) {
      setShowError(true)
      const t = setTimeout(() => setShowError(false), 5000)
      return () => clearTimeout(t)
    }
  }, [flash?.error])

  /* ------------------------------ Helpers ------------------------------------ */
  const go = (extra: Record<string, any> = {}) =>
    router.get(
      route('promotions.index'),
      {
        search: searchVal || undefined,
        type: typeVal || undefined,
        active: activeVal || undefined,
        per_page: per_page,
        ...extra,
      },
      { preserveScroll: true, preserveState: true },
    )

  const changePage = (p: number) => go({ page: p })
  const changePer = (n: number) => go({ page: 1, per_page: n })

  const resetFilters = () => {
    setSearchVal('')
    setTypeVal('')
    setActiveVal('')
    router.get(
      route('promotions.index'),
      { page: 1, per_page: per_page || 15 },
      { preserveScroll: true, preserveState: true },
    )
  }

  const windowPages = useMemo<(number | '…')[]>(() => {
    const pages: (number | '…')[] = []
    const MAX = 5
    const c = current_page
    const l = last_page

    if (l <= MAX + 2) {
      for (let i = 1; i <= l; i++) pages.push(i)
      return pages
    }

    pages.push(1)
    let start = Math.max(2, c - Math.floor(MAX / 2))
    let end = start + MAX - 1

    if (end >= l) {
      end = l - 1
      start = end - MAX + 1
    }

    if (start > 2) pages.push('…')
    for (let i = start; i <= end; i++) pages.push(i)
    if (end < l - 1) pages.push('…')
    pages.push(l)

    return pages
  }, [current_page, last_page])

  /* --------------------------------- CRUD ------------------------------------ */
  const toggleStatus = (row: PromotionRow) => {
    const next = !row.is_active
    // ⬇️ la route accepte PATCH (web.php), pas PUT
    router.patch(
      route('promotions.update', row.id),
      { is_active: next },
      {
        preserveScroll: true,
        onSuccess: () => toast.success(next ? 'Promotion activée' : 'Promotion désactivée'),
        onError:   () => toast.error('Impossible de mettre à jour'),
      }
    )
  }

  const destroyOne = (row: PromotionRow) => {
    if (!can('promotion_delete')) return alert('Permission manquante: promotion_delete')
    if (!confirm(`Supprimer la promotion « ${row.name} » ?`)) return
    router.delete(route('promotions.destroy', row.id), {
      preserveScroll: true,
      onSuccess: () => { toast.success('Promotion supprimée') },
      onError:   () => { toast.error('Suppression impossible') },
    })
  }

  const openEdit   = (row: PromotionRow) => { setEditing(row); setOpen(true) }

  /* ------------------------ Utility functions --------------------------- */
  const fmtAction = (row: PromotionRow) => {
    const a = row.actions?.[0]
    if (!a || a.value == null) return '—'
    const v = Number(a.value)
    if (!Number.isFinite(v)) return '—'
    return a.action_type === 'percent'
      ? `${v}%`
      : `${v} MAD`
  }

  const fmtPeriod = (row: PromotionRow) => {
    const from = row.starts_at ? new Date(row.starts_at).toLocaleString('fr-FR') : 'dès maintenant'
    const to   = row.ends_at   ? ` au ${new Date(row.ends_at).toLocaleString('fr-FR')}` : ''
    return `${from}${to}`
  }

  const canCreate = can('promotion_create')
  const canEdit   = can('promotion_edit')
  const canDelete = can('promotion_delete')

  /* -------------------------------------------------------------------- */
  /*                                 RENDER                               */
  /* -------------------------------------------------------------------- */
  return (
    <>
      <Head title="Promotions" />

      <AppLayout
        breadcrumbs={[
          { title: 'Dashboard', href: '/dashboard' },
          { title: 'Promotions', href: '/promotions' }, // ⬅️ breadcrumb public
        ]}
      >
        <div className="relative">
          <ParticlesBackground />

          <div className="relative z-10 w-full py-6 px-4">
            {/* ---------------- FLASH ---------------- */}
            {flash?.success && showSuccess && (
              <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 flex items-start gap-3 dark:bg-green-900 dark:border-green-700 dark:text-green-100 animate-fade-in">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <p className="flex-1 font-medium">{flash.success}</p>
                <button
                  onClick={() => setShowSuccess(false)}
                  className="text-green-500 hover:text-green-700 dark:text-green-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            {flash?.error && showError && (
              <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 dark:bg-red-900 dark:border-red-700 dark:text-red-100 animate-fade-in">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="flex-1 font-medium">{flash.error}</p>
                <button
                  onClick={() => setShowError(false)}
                  className="text-red-500 hover:text-red-700 dark:text-red-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* -------------------------------- Header -------------------------------- */}
            <div className="flex items-center gap-3 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Gestion des promotions
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Gérez vos remises, codes promotionnels et fenêtres de validité
                </p>
              </div>
            </div>

            {/* -------------------------------- Tools --------------------------------- */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6 mb-6">
              <div className="flex flex-wrap gap-4 justify-between">
                {/* Bloc gauche : filtres */}
                <div className="flex flex-col gap-4 w-full lg:w-auto">
                  <div className="flex items-center gap-3">
                    <Button onClick={() => setShowFilterPanel((v) => !v)}>
                      <Filter className="w-4 h-4" />
                      {showFilterPanel ? 'Masquer les filtres' : 'Afficher les filtres'}
                    </Button>

                    {(searchVal || typeVal || activeVal) && (
                      <Button variant="outline" onClick={resetFilters} className="gap-1.5">
                        <X className="w-4 h-4" /> Effacer filtres
                      </Button>
                    )}
                  </div>

                  {showFilterPanel && (
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 w-full lg:max-w-3xl relative z-[60]">
                      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4" /> Filtrer les promotions
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        {/* Recherche */}
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input
                            className="pl-9"
                            placeholder="Rechercher par nom, code…"
                            value={searchVal}
                            onChange={(e) => setSearchVal(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && go({ page: 1 })}
                          />
                        </div>

                        {/* Type de promo */}
                        <Select value={typeVal ?? ''} onValueChange={(v)=>setTypeVal(v as Props['filters']['type'])}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Tous</SelectItem>
                            <SelectItem value="order">Commande</SelectItem>
                            <SelectItem value="category" disabled>Catégorie</SelectItem>
                            <SelectItem value="product" disabled>Produit</SelectItem>
                            <SelectItem value="bogo" disabled>BOGO</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Statut actif */}
                        <Select value={activeVal ?? ''} onValueChange={(v)=>setActiveVal(v as Props['filters']['active'])}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Statut" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Toutes</SelectItem>
                            <SelectItem value="1">Actives</SelectItem>
                            <SelectItem value="0">Inactives</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button onClick={() => go({ page: 1 })} className="w-full sm:w-auto">
                        Appliquer les filtres
                      </Button>
                    </div>
                  )}
                </div>

                {/* Bloc droit : rows per page + bouton ajouter */}
                <div className="flex items-center gap-3 ml-auto">
                  <div className="relative min-w-[220px]">
                    <select
                      value={per_page}
                      onChange={(e) => changePer(Number(e.target.value))}
                      className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-4 pr-10 py-2.5 text-sm text-slate-600 dark:text-slate-100"
                    >
                      {[5, 10, 15, 25, 50].map((n) => (
                        <option key={n} value={n}>
                          {n} lignes par page
                        </option>
                      ))}
                      <option value={-1}>Tous</option>
                    </select>
                    {/* caret visuel */}
                    <svg className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"/></svg>
                  </div>

                  {canCreate && (
                    <Link href={route('promotions.create')}>
                      <Button className="bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-600 shadow-md">
                        <Plus className="w-4 h-4 mr-1" />
                        Nouvelle promotion
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* -------------------------------- Table --------------------------------- */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl overflow-auto">
              <table className="min-w-full text-sm divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        Nom
                      </div>
                    </th>
                    <th className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Shield className="w-4 h-4" />
                        Type / Portée
                      </div>
                    </th>
                    <th className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <PercentIcon className="w-4 h-4" />
                        Remise
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <MoreHorizontal className="w-4 h-4" />
                        Priorité
                      </div>
                    </th>
                    <th className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Période
                      </div>
                    </th>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Power className="w-4 h-4" />
                        Statut
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <MoreHorizontal className="w-4 h-4" />
                        Actions
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                        Aucune promotion trouvée
                      </td>
                    </tr>
                  ) : rows.map(row => {
                    const code = row.codes?.[0]?.code
                    return (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        {/* Nom + desc */}
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900 dark:text-white">{row.name}</div>
                          {row.description && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{row.description}</div>
                          )}
                        </td>

                        {/* Type / portée */}
                        <td className="px-6 py-4">
                          <Badge variant="secondary">{row.type}</Badge>
                          <span className="text-xs text-slate-500 ml-2">scope: {row.apply_scope}</span>
                        </td>

                        {/* Remise */}
                        <td className="px-6 py-4">
                          <span className="font-medium">{fmtAction(row)}</span>
                        </td>

                        {/* Priorité */}
                        <td className="px-6 py-4 text-center">{row.priority}</td>

                        {/* Période */}
                        <td className="px-6 py-4">
                          <div className="text-xs">{fmtPeriod(row)}</div>
                        </td>

                        {/* Code */}
                        <td className="px-6 py-4">{code ?? <span className="text-slate-400">—</span>}</td>

                        {/* Statut (badge cliquable) */}
                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => canEdit && toggleStatus(row)}
                            className="inline-flex items-center justify-center"
                            title={row.is_active ? 'Cliquer pour désactiver' : 'Cliquer pour activer'}
                            aria-label={row.is_active ? 'Désactiver la promotion' : 'Activer la promotion'}
                            disabled={!canEdit}
                          >
                            {row.is_active ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:opacity-90 cursor-pointer disabled:opacity-60">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 hover:opacity-90 cursor-pointer disabled:opacity-60">
                                Inactive
                              </Badge>
                            )}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            {canEdit && (
                              <Button size="icon" variant="ghost" onClick={()=>openEdit(row)} aria-label="Éditer">
                                <Edit2 className="w-4 h-4"/>
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={()=>destroyOne(row)}
                                aria-label="Supprimer"
                                className="hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="w-4 h-4 text-red-600"/>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ------------------------------ Pagination ------------------------------ */}
            <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl mt-4 text-sm text-slate-700 dark:text-slate-200">
              <span>
                Affichage de {from} à {to} sur {total} promotions
              </span>

              {last_page > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={current_page === 1}
                    onClick={() => changePage(1)}
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={current_page === 1}
                    onClick={() => changePage(current_page - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  {windowPages.map((p, idx) =>
                    p === '…' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 select-none">
                        …
                      </span>
                    ) : (
                      <Button
                        key={`page-${p}`}
                        size="sm"
                        variant={p === current_page ? 'default' : 'outline'}
                        onClick={() => changePage(p as number)}
                      >
                        {p}
                      </Button>
                    ),
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={current_page === last_page}
                    onClick={() => changePage(current_page + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={current_page === last_page}
                    onClick={() => changePage(last_page)}
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* ------------------------------ Modal Edit ------------------------------ */}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Modifier la promotion</DialogTitle>
                </DialogHeader>
                {editing && (
                  <PromotionForm
                    initial={{
                      id: editing.id,
                      name: editing.name,
                      description: editing.description ?? undefined,
                      type: editing.type,
                      apply_scope: editing.apply_scope,
                      is_active: editing.is_active,
                      is_exclusive: editing.is_exclusive,
                      priority: editing.priority,
                      starts_at: editing.starts_at ?? undefined,
                      ends_at: editing.ends_at ?? undefined,
                      action_type: (editing.actions?.[0]?.action_type as 'percent'|'fixed'|undefined),
                      // ⬇️ on force en nombre si présent
                      value: editing.actions?.[0]?.value != null ? Number(editing.actions[0].value) : undefined,
                      code: editing.codes?.[0]?.code,
                    }}
                    onSaved={()=>{ setOpen(false); setEditing(null); router.reload({ only: ['promotions'] }) }}
                  />
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </AppLayout>
    </>
  )
}
