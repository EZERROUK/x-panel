import React, { useMemo, useState } from 'react'
import { Head, Link, usePage } from '@inertiajs/react'
import { route } from 'ziggy-js'
import {
  ArrowLeft, Pencil, Info, Layers, Folder, FolderOpen,
  Hash, Calendar, Tag, Users, ChevronRight, Activity, Clipboard,
  ListChecks, Eye, EyeOff, Filter, List as ListIcon
} from 'lucide-react'

import AppLayout from '@/layouts/app-layout'
import { Button } from '@/components/ui/button'

/* ------------------------------------------------------------------ */
/* Types & props                                                      */
/* ------------------------------------------------------------------ */
type Tab = 'overview' | 'hierarchy' | 'description' | 'attributes' | 'activity'

interface CategoryAttributeOption {
  id: number | string
  label: string
  value: string
  color?: string | null
  sort_order?: number
  is_active?: boolean
}

interface CategoryAttribute {
  id: number | string
  name: string
  slug: string
  type: 'text'|'textarea'|'number'|'decimal'|'boolean'|'select'|'multiselect'|'date'|'url'|'email'|'json'
  unit?: string | null
  description?: string | null
  is_required?: boolean
  is_filterable?: boolean
  is_searchable?: boolean
  show_in_listing?: boolean
  is_active?: boolean
  sort_order?: number
  default_value?: string | null
  validation_rules?: Record<string, unknown> | Array<{rule:string; value?:unknown}>
  options?: CategoryAttributeOption[]
}

interface Category {
  id: number | string
  name: string
  description?: string | null
  slug: string
  parent_id?: number | string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  parent?: Category | null
  children?: Category[]
  products_count?: number
  // Ajout : attributs chargés côté backend
  attributes?: CategoryAttribute[]

  // champs potentiels côté backend pour l'auteur
  created_by_name?: string | null
  created_by?: { id?: number|string; name?: string | null } | null
  creator?: { id?: number|string; name?: string | null } | null
  user?:    { id?: number|string; name?: string | null } | null
}

interface Can {
  update: boolean
  delete: boolean
  create: boolean
  // optionnel: certains backends exposent directement les permissions spatie :
  category_edit?: boolean
}

interface ActivityItem {
  id: string | number
  action: string
  actor?: { id?: number|string; name: string } | null
  created_at: string
  meta?: Record<string, any>
}

interface PageAuth {
  permissions?: string[]
  abilities?: string[]
  user?: { permissions?: string[] }
}

interface PageShared {
  auth?: PageAuth
  can?: Record<string, boolean> | undefined
}

interface Props {
  category: Category
  breadcrumbs?: Array<Pick<Category, 'id' | 'name'>>
  can?: Can
  logs?: ActivityItem[]
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */
export default function ShowCategory({
  category,
  breadcrumbs = [],
  can = { update: false, delete: false, create: false },
  logs = [],
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const page = usePage<PageShared>()

  // ----------- Détection robuste de la permission Spatie -----------
  const hasCategoryEdit = useMemo(() => {
    const set = new Set<string>([
      ...(page.props?.auth?.permissions ?? []),
      ...(page.props?.auth?.abilities ?? []),
      ...(page.props?.auth?.user?.permissions ?? []),
    ].filter(Boolean) as string[])

    const canGlobalFlag = page.props?.can && typeof page.props.can['category_edit'] === 'boolean'
      ? page.props.can['category_edit']
      : false

    const canObjectFlag = typeof can.category_edit === 'boolean' ? can.category_edit : false

    return set.has('category_edit') || canGlobalFlag || canObjectFlag || can.update === true
  }, [page.props, can])

  /* ---------------------------------------------------------------- */
  /* Données dérivées                                                 */
  /* ---------------------------------------------------------------- */
  const children = category.children ?? []
  const created  = new Date(category.created_at)
  const updated  = category.updated_at ? new Date(category.updated_at) : null
  const attributes = (category.attributes ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const depthFromCrumbs = breadcrumbs.length
    ? Math.max(0, breadcrumbs.length - 1)
    : (category.parent ? 1 : 0)

  const isRoot   = !category.parent
  const typeText = isRoot ? 'Catégorie racine' : 'Sous-catégorie'
  const level    = depthFromCrumbs

  // Auteur de la création (plusieurs fallbacks possibles)
  const creatorName =
    category.created_by_name
    ?? category.created_by?.name
    ?? category.creator?.name
    ?? category.user?.name
    ?? null

  const copySlug = async () => {
    try {
      await navigator.clipboard.writeText(category.slug)
    } catch { /* no-op */ }
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <>
      <Head title={`Catégorie – ${category.name}`} />

      {/* Fond en dégradé identique à la page de connexion / modèle */}
      <div className="min-h-screen bg-gradient-to-br from-white via-slate-100 to-slate-200 dark:from-[#0a0420] dark:via-[#0e0a32] dark:to-[#1B1749] transition-colors duration-500">
        <AppLayout
          breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Catégories', href: route('categories.index') },
            { title: category.name, href: route('categories.show', category.id) },
          ]}
        >

          {/* -------- Bandeau haut -------- */}
          <div className="p-6">
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl flex flex-col lg:flex-row gap-6 items-start px-4 sm:px-5 py-4 sm:py-5">
              <div className="w-32 h-32 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                {category.is_active
                  ? <FolderOpen className="w-12 h-12 text-red-600 dark:text-red-500" />
                  : <Folder className="w-12 h-12 text-slate-400" />}
              </div>

              <div className="flex-1 space-y-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{category.name}</h1>

                {/* Fil d’Ariane secondaire (optionnel) */}
                {breadcrumbs.length > 0 && (
                  <div className="flex items-center flex-wrap gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <Link href={route('categories.index')} className="hover:underline">Catégories</Link>
                    {breadcrumbs.map((b, i) => (
                      <React.Fragment key={b.id}>
                        <ChevronRight className="w-3 h-3 opacity-60" />
                        {i === breadcrumbs.length - 1
                          ? <span className="text-slate-700 dark:text-slate-300">{b.name}</span>
                          : <Link href={route('categories.show', b.id)} className="hover:underline">{b.name}</Link>}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {category.is_active
                    ? <Badge text="Active" color="green" />
                    : <Badge text="Inactive" color="red" />}

                  {typeof category.products_count === 'number' && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                      <Users className="w-4 h-4" />
                      {category.products_count} produit{category.products_count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Parente / Enfant + Niveau */}
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-medium">{typeText}</span>
                  {category.parent && (
                    <>
                      {' · '}Parent :{' '}
                      <Link href={route('categories.show', category.parent.id)} className="text-red-600 dark:text-red-500 hover:underline">
                        {category.parent.name}
                      </Link>
                    </>
                  )}
                  {' · '}Niveau : <span className="font-mono">{level}</span>
                </div>

                {/* Création : date + auteur (juste sous le niveau) */}
                <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 opacity-70" />
                  <span>
                    Créée le <span className="font-medium">{created.toLocaleString('fr-FR')}</span>
                    {creatorName && <> par <span className="font-medium">{creatorName}</span></>}
                  </span>
                </div>
              </div>

              {/* Colonne d’actions : Retour, Attributs (avec icône), Modifier */}
           <div className="flex flex-col gap-2 w-full sm:w-auto">
<Link href={route('categories.index')} className="w-full">
  <Button
    className="w-full group relative flex items-center justify-center
               rounded-lg bg-gradient-to-r from-gray-200 to-gray-300 px-5 py-3
               text-sm font-semibold text-gray-800 transition-all
               hover:from-gray-300 hover:to-gray-400 focus:ring-2 focus:ring-gray-400"
  >
    <ArrowLeft className="w-4 h-4 mr-2" />
    Retour
  </Button>
</Link>

{hasCategoryEdit && (
  <>
    <Link href={route('categories.attributes.edit', category.id)} className="w-full">
      <Button
        className="w-full group relative flex items-center justify-center
                   rounded-lg bg-gradient-to-r from-[#1B1749] to-[#2a246d] px-5 py-3
                   text-sm font-semibold text-white transition-all
                   hover:from-[#2a246d] hover:to-[#1B1749] focus:ring-2 focus:ring-[#1B1749]"
      >
        <ListChecks className="w-4 h-4 mr-2" />
        Gérer les attributs
      </Button>
    </Link>

    <Link href={route('categories.edit', category.id)} className="w-full">
      <Button
        className="w-full group relative flex items-center justify-center
                   rounded-lg bg-gradient-to-r from-red-600 to-red-500 px-5 py-3
                   text-sm font-semibold text-white transition-all
                   hover:from-red-500 hover:to-red-600 focus:ring-2 focus:ring-red-500"
      >
        <Pencil className="w-4 h-4 mr-2" />
        Modifier
      </Button>
    </Link>
  </>
)}




</div>

            </div>
          </div>

          {/* -------- Onglets -------- */}
          <div className="flex-grow px-6 pt-2 pb-6">
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl grid grid-cols-1 md:grid-cols-4 min-h-[350px]">
              {/* liste des tabs */}
              <div className="border-r border-slate-200 dark:border-slate-700 flex flex-col">
                {(['overview','hierarchy','description','attributes','activity'] as Tab[]).map(tab => (
                  <TabButton key={tab} tab={tab} active={activeTab} setActive={setActiveTab} />
                ))}
              </div>

              {/* contenu */}
              <div className="p-6 md:col-span-3 overflow-y-auto text-slate-700 dark:text-slate-300">
                {/* --- Aperçu / Détails --- */}
              {/* --- Aperçu / Détails --- */}
{activeTab === 'overview' && (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
    <Detail icon={Hash}   label="Slug"         value={
      <div className="flex items-center gap-2">
        <code className="font-mono">{category.slug}</code>
        <button
          type="button"
          onClick={copySlug}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-white/5"
          title="Copier le slug"
        >
          <Clipboard className="w-3.5 h-3.5" /> Copier
        </button>
      </div>
    } />
    <Detail icon={Layers} label="Ordre de tri" value={category.sort_order} />

    {/* 👇 existant */}
    <Detail icon={Calendar} label="Créé le"    value={created.toLocaleString('fr-FR')} />

    {/* 👇 AJOUT: juste après "Créé le" */}
    {creatorName && (
      <Detail icon={Users} label="Créé par" value={creatorName} />
    )}

    {updated && <Detail icon={Calendar} label="Modifié le" value={updated.toLocaleString('fr-FR')} />}

    {typeof category.products_count === 'number' && (
      <Detail icon={Users} label="Produits" value={category.products_count} />
    )}
  </div>
)}


                {/* --- Hiérarchie (parente + sous-catégories) --- */}
                {activeTab === 'hierarchy' && (
                  <div className="space-y-8">
                    {/* Parente */}
                    {category.parent ? (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white/90 border-b border-slate-200 dark:border-slate-700 pb-1">
                          Catégorie parente
                        </h3>
                        <Link
                          href={route('categories.show', category.parent.id)}
                          className="block border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition bg-white dark:bg-white/5 backdrop-blur-md"
                        >
                          <div className="flex items-center gap-3">
                            <FolderOpen className="w-5 h-5 text-orange-600" />
                            <div className="flex-1">
                              <div className="font-medium text-slate-900 dark:text-white/90">{category.parent.name}</div>
                              {category.parent.description && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                  {category.parent.description}
                                </div>
                              )}
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          </div>
                        </Link>
                      </div>
                    ) : (
                      <p className="text-slate-500 dark:text-slate-400 italic">Aucune catégorie parente.</p>
                    )}

                    {/* Sous-catégories */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white/90 border-b border-slate-200 dark:border-slate-700 pb-1">
                          Sous-catégories ({children.length})
                        </h3>
                        {can.create && hasCategoryEdit && (
                          <Link href={route('categories.create', { parent_id: category.id })}>
                            <Button className="rounded-lg bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-600">
                              Nouvelle sous-catégorie
                            </Button>
                          </Link>
                        )}
                      </div>

                      {children.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {children.map(child => (
                            <Link
                              key={child.id}
                              href={route('categories.show', child.id)}
                              className="group border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition bg-white dark:bg-white/5 backdrop-blur-md"
                            >
                              <div className="flex items-center gap-3">
                                {child.is_active
                                  ? <FolderOpen className="w-5 h-5 text-green-600 group-hover:scale-110 transition-transform" />
                                  : <Folder className="w-5 h-5 text-slate-400" />}
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-slate-900 dark:text-white/90 truncate">{child.name}</div>
                                  {child.description && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                      {child.description}
                                    </div>
                                  )}
                                  <div className="mt-2 flex items-center gap-2">
                                    {child.is_active
                                      ? <Badge text="Active" color="green" />
                                      : <Badge text="Inactive" color="red" />}
                                    {typeof child.products_count === 'number' && (
                                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {child.products_count} produit{child.products_count !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400 italic">Aucune sous-catégorie.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* --- Description --- */}
                {activeTab === 'description' && (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {category.description
                      ? <p className="whitespace-pre-line">{category.description}</p>
                      : <p className="text-slate-500 dark:text-slate-400 italic">Aucune description disponible.</p>}
                  </div>
                )}

                {/* --- Attributs --- */}
                {activeTab === 'attributes' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white/90">
                        Attributs ({attributes.length})
                      </h3>
                      <Link href={route('categories.attributes.edit', category.id)}>
                        <Button size="sm" variant="outline" className="flex items-center gap-2">
                          <ListChecks className="w-4 h-4" />
                          Gérer
                        </Button>
                      </Link>
                    </div>

                    {attributes.length === 0 ? (
                      <div className="text-center py-12">
                        <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          Aucun attribut défini pour cette catégorie.
                        </div>
                      </div>
                    ) : (
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {attributes.map(attr => (
                          <li key={attr.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-white/5 backdrop-blur-md">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-900 dark:text-white/90 truncate">{attr.name}</span>
                                  <code className="px-1.5 py-0.5 text-[11px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {attr.slug}
                                  </code>
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                                  <TypeBadge type={attr.type} />
                                  {attr.unit && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">Unité: {attr.unit}</span>}
                                  {attr.default_value && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">Par défaut: <code>{attr.default_value}</code></span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {attr.is_active ? <Eye className="w-4 h-4 text-green-600" title="Actif" /> : <EyeOff className="w-4 h-4 text-slate-400" title="Inactif" />}
                              </div>
                            </div>

                            {attr.description && (
                              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{attr.description}</p>
                            )}

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                              {attr.is_required && <Badge text="Obligatoire" color="red" />}
                              {attr.is_filterable && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  <Filter className="w-3 h-3" /> Filtrable
                                </span>
                              )}
                              {attr.show_in_listing && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  <ListIcon className="w-3 h-3" /> Listing
                                </span>
                              )}
                            </div>

                            {/* Options pour select/multiselect */}
                            {['select','multiselect'].includes(attr.type) && (attr.options ?? []).length > 0 && (
                              <div className="mt-4">
                                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Options</div>
                                <div className="flex flex-wrap gap-2">
                                  {(attr.options ?? []).sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).map(opt => (
                                    <span key={opt.id}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs">
                                      <span className="font-medium">{opt.label}</span>
                                      <code className="opacity-70">({opt.value})</code>
                                      {opt.color && (
                                        <span className="inline-block w-3 h-3 rounded-full border border-slate-300"
                                              style={{ backgroundColor: opt.color }} />
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* --- Activités / Logs --- */}
                {activeTab === 'activity' && (
                  <div className="space-y-4">
                    {logs.length ? (
                      <ul className="space-y-3">
                        {logs.map(item => (
                          <li
                            key={item.id}
                            className="flex items-start gap-3 border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-white/5 backdrop-blur-md"
                          >
                            <Activity className="w-5 h-5 text-red-600 dark:text-red-500 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                <span className="font-medium text-slate-900 dark:text-white/90">
                                  {item.actor?.name ?? 'Système'}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">a</span>
                                <span className="font-medium text-slate-900 dark:text-white/90">
                                  {actionLabel(item.action)}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  le {formatDate(item.created_at)}
                                </span>
                              </div>
                              {item.meta && (
                                <pre className="mt-2 text-xs text-slate-500 dark:text-slate-400 overflow-x-auto">
{JSON.stringify(item.meta, null, 2)}
                                </pre>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-center py-12">
                        <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          Aucune activité récente pour cette catégorie.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </AppLayout>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function actionLabel(a: string) {
  switch (a) {
    case 'created': return 'créé la catégorie'
    case 'updated': return 'modifié la catégorie'
    case 'deleted': return 'supprimé la catégorie'
    case 'status_changed': return 'changé le statut'
    default: return a
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('fr-FR')
}

/* ------------------------------------------------------------------ */
/* UI helpers                                                         */
/* ------------------------------------------------------------------ */
const Badge = ({ text, color }: { text:'Active'|'Inactive'|'Obligatoire'|string; color:'red'|'green' }) => (
  <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium select-none tracking-wide
    ${color==='red' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                     :'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'}`}>
    {text}
  </span>
)

const Detail = ({ icon: Icon, label, value }:{
  icon: typeof Layers; label:string; value:React.ReactNode;
}) => (
  <div className="flex items-start gap-3">
    <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500 mt-1" />
    <div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-900 dark:text-white/90 break-all">{value}</div>
    </div>
  </div>
)

const TabButton = ({ tab, active, setActive }:{
  tab:Tab; active:Tab; setActive:(t:Tab)=>void;
}) => {
  const icons:Record<Tab,JSX.Element> = {
    overview:<Info className="inline w-4 h-4 mr-2"/>,
    hierarchy:<FolderOpen className="inline w-4 h-4 mr-2"/>,
    description:<Tag className="inline w-4 h-4 mr-2"/>,
    attributes:<ListChecks className="inline w-4 h-4 mr-2"/>,
    activity:<Activity className="inline w-4 h-4 mr-2"/>,
  }
  const labels:Record<Tab,string> = {
    overview:'Détails',
    hierarchy:'Hiérarchie',
    description:'Description',
    attributes:'Attributs',
    activity:'Activités / Logs',
  }
  const isActive = active===tab
  return (
    <button
      onClick={() => setActive(tab)}
      className={`w-full px-4 py-3 text-left text-sm font-medium transition flex items-center
        ${isActive
          ? 'bg-gradient-to-r from-red-600 to-red-500 text-white rounded-l-xl shadow-inner'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white'}
      `}>
      {icons[tab]} {labels[tab]}
    </button>
  )
}

const TypeBadge = ({ type }:{ type: CategoryAttribute['type'] }) => {
  const labelMap: Record<CategoryAttribute['type'], string> = {
    text:'Texte', textarea:'Texte long', number:'Nombre', decimal:'Décimal', boolean:'Oui/Non',
    select:'Liste', multiselect:'Liste multiple', date:'Date', url:'URL', email:'Email', json:'JSON'
  }
  return (
    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
      {labelMap[type] ?? type}
    </span>
  )
}
