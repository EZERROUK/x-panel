/* cspell:ignore Variantes */
import React, { JSX, useMemo, useState } from 'react'
import { Head, Link } from '@inertiajs/react'
import { route } from 'ziggy-js'
import {
  ArrowLeft, Pencil, Info,
  Image as GalleryIcon, FileText, Link2,
  Hash, Calendar, Store, BadgeEuro, Tag, Layers, Package,
  Eye, EyeOff, Type as TypeIcon, Ruler, Percent, ShieldCheck, Clock, Link as LinkIcon,
  Sliders
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import AppLayout from '@/layouts/app-layout'
import { Button } from '@/components/ui/button'
import type { PageProps, Product as ProductType, CompatibilityItem } from '@/types'

import Lightbox from 'yet-another-react-lightbox'
import type { Slide } from 'yet-another-react-lightbox'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'

/* ------------------------------------------------------------------ /
/ Types & props                                                      /
/ ------------------------------------------------------------------ */
type Tab =
  | 'commerce'
  | 'pricing'
  | 'availability'
  | 'dimensions'
  | 'attributes'
  | 'digital'
  | 'seo'
  | 'meta'
  | 'gallery'
  | 'compat'

interface Props extends PageProps<{
  product: ProductType & {
    images?: { id: number; path: string; is_primary: boolean; deleted_at: string | null }[]
    brand?: { id: number; name: string } | null
    category?: { id: number; name: string; slug?: string } | null
    currency?: { code: string; symbol: string } | null
    tax_rate?: { id: number; name: string; rate: number } | null
    attributes?: Record<string, any> | null
  }
  allCompatibilities?: CompatibilityItem[]
}> { }

/* ------------------------------------------------------------------ /
/ Component                                                          /
/ ------------------------------------------------------------------ */
export default function ShowProduct({ product, allCompatibilities = [] }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('commerce')
  const [open, setOpen] = useState<number | false>(false)

  /* ------------------------------------------------------------------ /
  / Données & calculs dérivés                                          /
  / ------------------------------------------------------------------ */
  const imgs = product.images ?? []
  const slides: Slide[] = imgs.map(i => ({ src: `/storage/${i.path}`, alt: product.name }))
  const primaryImg = imgs.find(i => i.is_primary) ?? imgs[0]

  const isDeleted = Boolean((product as any).deleted_at)
  const created = product.created_at ? new Date(product.created_at) : null
  const updated = product.updated_at ? new Date(product.updated_at) : null

  // 👇 Nouveau : même logique de "créé par" que Catégories
  const creatorName =
    (product as any).created_by_name ??
    (product as any).created_by?.name ??
    (product as any).created_by ??
    null

  const currencySymbol = product.currency?.symbol ?? fallbackCurrencySymbol((product as any).currency_code)
  const currencyCode = product.currency?.code ?? (product as any).currency_code ?? ''

  const vatRate = Number(
    (product as any).tax_rate?.rate ??
    (product as any).taxRate?.rate ??
    0
  ) || 0

  const price = toFloat((product as any).price)
  const cost = toFloat((product as any).cost_price)
  const compare = toFloat((product as any).compare_at_price)

  const priceTTC = price > 0 ? round2(price * (1 + vatRate / 100)) : 0
  const marginAbs = price > 0 ? round2(price - cost) : 0
  const marginPct = price > 0 ? round1(((price - cost) / price) * 100) : 0

  const minTolType = ((product as any).min_tolerance_type ?? '') as '' | 'percentage' | 'amount'
  const minTolValue = toFloat((product as any).min_tolerance_value)
  const minAllowedPrice = computeMinAllowedPrice(price, minTolType, minTolValue)

  const availabilityFrom = formatDateTimeReadable((product as any).available_from)
  const availabilityUntil = formatDateTimeReadable((product as any).available_until)
  const isAvailableNow = Boolean((product as any).is_available)

  // Regroupement compatibilités par catégorie
  const compatByCat = useMemo(() => {
    return (allCompatibilities || []).reduce((acc, c) => {
      const key = c.category ?? 'Autre'
      if (!acc[key]) acc[key] = []
      acc[key].push(c)
      return acc
    }, {} as Record<string, CompatibilityItem[]>)
  }, [allCompatibilities])

  // Traductions simples
  const visibilityLabel = toVisibilityLabel((product as any).visibility)
  const typeLabel = toTypeLabel((product as any).type)

  // Ordre des onglets (du + important au - important)
  const tabsOrder: Tab[] = [
    'commerce',
    'pricing',
    'availability',
    'dimensions',
    'attributes',
    'digital',
    'seo',
    'meta',
    'gallery',
    'compat',
  ]

  /* ------------------------------------------------------------------ /
  / Render                                                             /
  / ------------------------------------------------------------------ */
  return (
    <>
      <Head title={`Produit – ${product.name}`} />

      <div className="min-h-screen bg-gradient-to-br from-white via-slate-100 to-slate-200 dark:from-[#0a0420] dark:via-[#0e0a32] dark:to-[#1B1749] transition-colors duration-500">
        <AppLayout breadcrumbs={[
          { title: 'Dashboard', href: '/dashboard' },
          { title: 'Produits', href: '/products' },
          { title: product.name, href: route('products.show', product.id) },
        ]}>

          {/* -------- Bandeau haut -------- */}
          <div className="p-6">
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl flex flex-col lg:flex-row gap-6 items-start px-4 sm:px-5 py-4 sm:py-5">
              <div className="w-32 h-32 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                {primaryImg
                  ? <img
                      src={`/storage/${primaryImg.path}`}
                      alt={product.name}
                      className={`w-full h-full ${isPng(primaryImg.path) ? 'object-contain' : 'object-cover'}`}
                    />
                  : <Package className="w-12 h-12 text-slate-400" />}
              </div>

              <div className="flex-1 space-y-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{product.name}</h1>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge text={isDeleted ? 'Désactivé' : 'Actif'} color={isDeleted ? 'red' : 'green'} />
                  {product.is_featured && <Badge text="En vedette" color="green" />}
                  {product.has_variants && <Badge text="Variantes" color="green" />}
                </div>

                {/* Ligne "Créé(e) le … par …" alignée sur Catégories */}
                <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 opacity-70" />
                  <span>
                    Créé le{' '}
                    <span className="font-medium">
                      {created ? created.toLocaleString('fr-FR') : '—'}
                    </span>
                    {creatorName && <> par <span className="font-medium">{creatorName}</span></>}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <Link href={route('products.index')} className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto">
                    <ArrowLeft className="w-4 h-4 mr-1" />Retour
                  </Button>
                </Link>
                {!isDeleted && (
                  <Link href={route('products.edit', product.id)} className="w-full sm:w-auto">
                    <Button className="group relative flex items-center justify-center rounded-lg bg-gradient-to-r from-red-600 to-red-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-red-500 hover:to-red-600 focus:ring-2 focus:ring-red-500">
                      <Pencil className="w-4 h-4 mr-2" />
                      Modifier
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* -------- Onglets -------- */}
          <div className="flex-grow px-6 pt-2 pb-6">
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl grid grid-cols-1 md:grid-cols-4 min-h-[350px]">
              {/* liste des tabs */}
              <div className="border-r border-slate-200 dark:border-slate-700 flex flex-col">
                {tabsOrder.map(tab => (
                  <TabButton key={tab} tab={tab} active={activeTab} setActive={setActiveTab} />
                ))}
              </div>

              {/* contenu */}
              <div className="p-6 md:col-span-3 overflow-y-auto text-slate-700 dark:text-slate-300">
                {/* --- COMMERCE & INVENTAIRE --- */}
                {activeTab === 'commerce' && (
                  <div className="space-y-8">
                    <Section title="Commerce & Inventaire" icon={<Store className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Detail icon={Hash} label="SKU" value={product.sku ?? '—'} />
                        <Detail icon={Tag} label="Marque" value={product.brand?.name ?? '—'} />
                        <Detail icon={TypeIcon} label="Type" value={typeLabel} />
                        <Detail icon={product.visibility === 'public' ? Eye : EyeOff} label="Visibilité" value={visibilityLabel} />
                        <Detail icon={Store} label="Catégorie" value={product.category?.name ?? '—'} />
                        <Detail icon={Clock} label="Suivi du stock" value={boolLabel(!!product.track_inventory)} />
                        <Detail icon={Package} label="Stock" value={String(product.stock_quantity ?? 0)} />
                        <Detail icon={Package} label="Seuil stock bas" value={product.low_stock_threshold ?? '—'} />
                        <Detail icon={Package} label="Précommande" value={boolLabel(!!product.allow_backorder)} />
                        <Detail icon={Layers} label="Variantes" value={boolLabel(!!product.has_variants)} />
                      </div>
                    </Section>
                  </div>
                )}

                {/* --- TARIFICATION --- */}
                {activeTab === 'pricing' && (
                  <div className="space-y-8">
                    <Section title="Tarification" icon={<BadgeEuro className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Detail icon={BadgeEuro} label="Prix (HT)" value={price > 0 ? `${formatMoney(price, currencySymbol)} ${currencyCode}` : '—'} />
                        <Detail icon={Percent} label="TVA" value={`${vatRate}%`} />
                        <Detail icon={BadgeEuro} label="Prix TTC (estimé)" value={price > 0 ? `${formatMoney(priceTTC, currencySymbol)} ${currencyCode}` : '—'} />
                        <Detail icon={Layers} label="Marge (estimée)" value={price > 0 ? `${formatMoney(marginAbs, currencySymbol)} ${currencyCode} (${marginPct}%)` : '—'} />
                        {compare > 0 && <Detail icon={BadgeEuro} label="Prix comparé" value={`${formatMoney(compare, currencySymbol)} ${currencyCode}`} />}
                      </div>
                    </Section>

                    <Section title="Tolérance / Prix plancher" icon={<ShieldCheck className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <Detail icon={ShieldCheck} label="Type de tolérance" value={tolTypeLabel(minTolType)} />
                        <Detail icon={ShieldCheck} label="Valeur" value={minTolType ? (minTolType === 'percentage' ? `${minTolValue}%` : `${formatMoney(minTolValue, currencySymbol)} ${currencyCode}`) : '—'} />
                        <Detail icon={ShieldCheck} label="Prix minimum autorisé" value={minAllowedPrice !== null ? `${formatMoney(minAllowedPrice, currencySymbol)} ${currencyCode}` : '—'} />
                      </div>
                    </Section>
                  </div>
                )}

                {/* --- DISPONIBILITÉ --- */}
                {activeTab === 'availability' && (
                  <div className="space-y-8">
                    <Section title="Disponibilité" icon={<Calendar className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Detail icon={Calendar} label="Disponible à partir du" value={availabilityFrom || '—'} />
                        <Detail icon={Calendar} label="Disponible jusqu’au" value={availabilityUntil || '—'} />
                      </div>
                    </Section>
                  </div>
                )}

                {/* --- DIMENSIONS & POIDS --- */}
                {activeTab === 'dimensions' && (
                  <div className="space-y-8">
                    <Section title="Dimensions & Poids" icon={<Ruler className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Detail icon={Ruler} label="Poids" value={fmtOrDash((product as any).weight, 'kg')} />
                        <Detail icon={Ruler} label="Longueur" value={fmtOrDash((product as any).length, 'cm')} />
                        <Detail icon={Ruler} label="Largeur" value={fmtOrDash((product as any).width, 'cm')} />
                        <Detail icon={Ruler} label="Hauteur" value={fmtOrDash((product as any).height, 'cm')} />
                      </div>
                    </Section>
                  </div>
                )}

                {/* --- ATTRIBUTS DYNAMIQUES --- */}
                {activeTab === 'attributes' && (
                  <div className="space-y-8">
                    <Section title="Attributs" icon={<Sliders className="w-4 h-4" />}>
                      {product.attributes && Object.keys(product.attributes).length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {Object.entries(product.attributes).map(([slug, val]) => (
                            <Detail
                              key={slug}
                              icon={Layers}
                              label={humanize(slug)}
                              value={renderAttrValue(val)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400 italic">Aucun attribut dynamique.</p>
                      )}
                    </Section>
                  </div>
                )}

                {/* --- DÉTAILS NUMÉRIQUES --- */}
                {activeTab === 'digital' && (
                  <div className="space-y-8">
                    <Section title="Détails numériques" icon={<LinkIcon className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Detail
                          icon={LinkIcon}
                          label="URL de téléchargement"
                          value={(product as any).download_url
                            ? <a className="text-red-600 hover:underline" href={(product as any).download_url} target="_blank" rel="noreferrer">{(product as any).download_url}</a>
                            : '—'}
                        />
                        <Detail icon={Clock} label="Limite de téléchargement" value={(product as any).download_limit ?? '—'} />
                        <Detail icon={Clock} label="Expiration (jours)" value={(product as any).download_expiry_days ?? '—'} />
                      </div>
                    </Section>
                  </div>
                )}

                {/* --- SEO --- */}
                {activeTab === 'seo' && (
                  <div className="space-y-8">
                    <Section title="SEO" icon={<FileText className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Detail icon={FileText} label="Meta title" value={(product as any).meta_title || '—'} />
                        <Detail icon={FileText} label="Mots-clés" value={(product as any).meta_keywords || '—'} />
                      </div>
                      <div className="mt-3">
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Meta description</div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white/90 whitespace-pre-line">
                          {(product as any).meta_description || '—'}
                        </div>
                      </div>
                    </Section>
                  </div>
                )}

                {/* --- MÉTADONNÉES --- */}
                {activeTab === 'meta' && (
                  <div className="space-y-8">
                    <Section title="Métadonnées" icon={<Info className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Detail icon={Calendar} label="Créé le" value={created ? created.toLocaleString('fr-FR') : '—'} />
                        <Detail icon={Calendar} label="Mis à jour le" value={updated ? updated.toLocaleString('fr-FR') : '—'} />
                      </div>
                    </Section>
                  </div>
                )}

                {/* --- GALERIE --- */}
                {activeTab === 'gallery' && (
                  slides.length ? (
                    <GalleryGrid slides={slides} open={open} setOpen={setOpen} />
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400 italic text-center py-8">Aucune image disponible.</p>
                  )
                )}

                {/* --- COMPATIBILITÉS --- */}
                {activeTab === 'compat' && (
                  Object.keys(compatByCat).length ? (
                    Object.entries(compatByCat).map(([cat, items]) => (
                      <div key={cat} className="mb-8">
                        <h4 className="font-semibold text-slate-900 dark:text-white/90 text-sm mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">
                          {cat}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {items.map(c => (
                            <Link
                              key={c.id}
                              href={route('products.show', c.id)}
                              className="block border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition bg-white dark:bg-white/5 backdrop-blur-md"
                            >
                              <div className="font-medium text-red-600 dark:text-red-500 hover:underline truncate">
                                {c.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {c.direction === 'uni' ? 'Unidirectionnelle' : 'Bidirectionnelle'}
                              </div>
                              {c.note && (
                                <div className="text-xs text-slate-600 dark:text-slate-400 italic mt-1 line-clamp-2">
                                  {c.note}
                                </div>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400 italic">Aucune compatibilité enregistrée.</p>
                  )
                )}
              </div>
            </div>
          </div>
        </AppLayout>
      </div>

      {/* Lightbox global */}
      <Lightbox
        open={typeof open === 'number'}
        index={open || 0}
        close={() => setOpen(false)}
        slides={slides}
        plugins={[Fullscreen, Thumbnails]}
      />
    </>
  )
}

/* ------------------------------------------------------------------ /
/ UI helpers                                                         /
/ ------------------------------------------------------------------ */
const Section = ({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode
}) => (
  <div>
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 flex items-center justify-center rounded bg-red-600/10 text-red-600 dark:text-red-400">{icon}</div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white/90">{title}</h3>
    </div>
    {children}
  </div>
)

const Badge = ({ text, color }: { text: string; color: 'red' | 'green' }) => (
  <span
    className={`inline-block px-2 py-1 text-xs rounded-full font-medium select-none tracking-wide
    ${color === 'red'
        ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
        : 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
      }`}
  >
    {text}
  </span>
)

const Detail = ({ icon: Icon, label, value }: {
  icon: LucideIcon; label: string; value: React.ReactNode;
}) => (
  <div className="flex items-start gap-3">
    <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500 mt-1" />
    <div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-900 dark:text-white/90 break-words">{value}</div>
    </div>
  </div>
)

const TabButton = ({ tab, active, setActive }: {
  tab: Tab; active: Tab; setActive: (t: Tab) => void;
}) => {
  const icons: Record<Tab, JSX.Element> = {
    commerce: <Store className="inline w-4 h-4 mr-2" />,
    pricing: <BadgeEuro className="inline w-4 h-4 mr-2" />,
    availability: <Calendar className="inline w-4 h-4 mr-2" />,
    dimensions: <Ruler className="inline w-4 h-4 mr-2" />,
    attributes: <Sliders className="inline w-4 h-4 mr-2" />,
    digital: <LinkIcon className="inline w-4 h-4 mr-2" />,
    seo: <FileText className="inline w-4 h-4 mr-2" />,
    meta: <Info className="inline w-4 h-4 mr-2" />,
    gallery: <GalleryIcon className="inline w-4 h-4 mr-2" />,
    compat: <Link2 className="inline w-4 h-4 mr-2" />,
  }
  const labels: Record<Tab, string> = {
    commerce: 'Commerce & Inventaire',
    pricing: 'Tarification',
    availability: 'Disponibilité',
    dimensions: 'Dimensions & Poids',
    attributes: 'Attributs',
    digital: 'Détails numériques',
    seo: 'SEO',
    meta: 'Métadonnées',
    gallery: 'Galerie',
    compat: 'Compatibilités',
  }
  const isActive = active === tab
  return (
    <button
      onClick={() => setActive(tab)}
      className={`w-full px-4 py-3 text-left text-sm font-medium transition flex items-center
        ${isActive
          ? 'bg-gradient-to-r from-red-600 to-red-500 text-white rounded-l-xl shadow-inner'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white'}`}
    >
      {icons[tab]} {labels[tab]}
    </button>
  )
}

const GalleryGrid = ({ slides, open, setOpen }: {
  slides: Slide[]; open: number | false; setOpen: (n: number | false) => void;
}) => (
  <div className="flex flex-wrap gap-4">
    {slides.map((img, i) => {
      const png = isPng(String(img.src))
      return (
        <button
          key={i}
          onClick={() => setOpen(i)}
          className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 shadow-sm hover:shadow-md transition"
          style={{
            width: 140, height: 104,
            backgroundColor: '#f8f8f8',
            backgroundImage: png
              ? `linear-gradient(45deg,rgba(120,120,120,.2) 25%,transparent 25%,transparent 75%,rgba(120,120,120,.2) 75%), linear-gradient(45deg,rgba(120,120,120,.2) 25%,transparent 25%,transparent 75%,rgba(120,120,120,.2) 75%)`
              : 'none',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0,8px 8px',
          }}
        >
          {/* img.alt est optionnel dans Slide, on fallback sur le nom du produit */}
          <img src={String(img.src)} alt={(img as any).alt ?? 'image'} className={`w-full h-full ${png ? 'object-contain' : 'object-cover'}`} />
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="opacity-0 group-hover:opacity-100 z-30 transition-opacity">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5a6 6 0 104.24 10.24l4.53 4.53a1 1 0 001.42-1.42l-4.53-4.53A6 6 0 0011 5z" />
              </svg>
            </div>
          </div>
        </button>
      )
    })}
  </div>
)

/* ------------------------------------------------------------------ /
/ Utils                                                              /
/ ------------------------------------------------------------------ */
function toFloat(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
function round2(n: number) { return Math.round(n * 100) / 100 }
function round1(n: number) { return Math.round(n * 10) / 10 }
function formatMoney(n: number, symbol: string) {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`.trim()
}
function computeMinAllowedPrice(price: number, type: '' | 'percentage' | 'amount', value: number): number | null {
  if (!type) return null
  if (value < 0) return Math.max(0, price)
  if (type === 'percentage') return Math.max(0, round2(price * (1 - value / 100)))
  if (type === 'amount') return Math.max(0, round2(price - value))
  return null
}
function isPng(path: string) { return path?.toLowerCase().endsWith('.png') }
function formatDateTimeReadable(s?: string | null) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('fr-FR')
}
function boolLabel(b: boolean) { return b ? 'Oui' : 'Non' }
function fmtOrDash(val: any, unit?: string) {
  if (val === null || val === undefined || val === '') return '—'
  const v = typeof val === 'number' ? val : Number(val)
  if (Number.isFinite(v)) return unit ? `${v} ${unit}` : String(v)
  return String(val)
}
function toVisibilityLabel(v?: string) {
  if (v === 'public') return 'Publique'
  if (v === 'hidden') return 'Masqué'
  if (v === 'draft') return 'Brouillon'
  return v ?? '—'
}
function toTypeLabel(t?: string) {
  if (t === 'physical') return 'Physique'
  if (t === 'digital') return 'Numérique'
  if (t === 'service') return 'Service'
  return t ?? '—'
}
function tolTypeLabel(t: '' | 'percentage' | 'amount') {
  if (!t) return '—'
  return t === 'percentage' ? 'Pourcentage' : 'Montant'
}
function fallbackCurrencySymbol(code?: string) {
  if (!code) return ''
  const map: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', MAD: 'DH', CAD: '$', CHF: 'CHF', JPY: '¥' }
  return map[code.toUpperCase()] ?? code
}
function humanize(key: string) {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}
function renderAttrValue(val: any): React.ReactNode {
  if (val === null || val === undefined || val === '') return '—'
  if (typeof val === 'boolean') return val ? 'Oui' : 'Non'
  if (Array.isArray(val)) {
    if (val.length === 0) return '—'
    return (
      <div className="flex flex-wrap gap-1.5">
        {val.map((v, i) => (
          <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {String(v)}
          </span>
        ))}
      </div>
    )
  }
  if (typeof val === 'object') {
    return (
      <pre className="text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md p-2 whitespace-pre-wrap break-words">
        {JSON.stringify(val, null, 2)}
      </pre>
    )
  }
  return String(val)
}
