import React, { useMemo, useState } from 'react'
import { Head, Link, router } from '@inertiajs/react'
import { route } from 'ziggy-js'
import {
  ArrowLeft, Package2, Download, Search,
  TrendingUp, TrendingDown, Equal, BarChart3,
  Eye, AlertTriangle, CheckCircle, XCircle,
  Grid3X3, List, Activity, Clock, PieChart as PieIcon
} from 'lucide-react'

import AppLayout from '@/layouts/app-layout'
import ParticlesBackground from '@/components/ParticlesBackground'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PageProps, Product } from '@/types'

// ⬇️ Imports requis pour le dashboard inline
import { motion } from 'framer-motion'
import {
  ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  ComposedChart, Area, Bar, Line, PieChart, Pie, Cell
} from 'recharts'

/* ------------------------------------------------------------------ */
/* Types & props                                                      */
/* ------------------------------------------------------------------ */
interface ReportProduct extends Product {
  total_in: number
  total_out: number
  total_adjustments: number
  category?: { id: number; name: string }
}

interface GlobalStats {
  total_products: number
  total_stock: number
  low_stock_count: number
  out_of_stock_count: number
  total_in: number
  total_out: number
  total_adjustments: number
}

/* Types pour le dashboard */
interface KPIsStock {
  total_in: { value: number }
  total_out: { value: number }
  net_change: { value: number }
  total_stock: { value: number }
  total_products: { value: number }
  low_stock_count: { value: number }
  out_of_stock_count: { value: number }
}
interface MovementsPoint { date: string; label: string; in: number; out: number; adjustments?: number; net?: number }
interface TopMoving { id: string|number|null; name: string; sku?: string|null; in: number; out: number; net: number; category?: { name: string } | null }
interface RecentMovement { id: string|number; type: 'in'|'out'|'adjustment'; product_name: string; sku?: string|null; quantity: number; reason?: string|null; created_at?: string|null }
interface CategoryBalance { name: string; stock: number }

interface Props extends PageProps<{
  products: ReportProduct[]
  globalStats: GlobalStats
  // props pour Dashboard
  period: string
  kpis: KPIsStock
  movementsChart: MovementsPoint[]
  topMoving: TopMoving[]
  recentMovements: RecentMovement[]
  categoryBalances: CategoryBalance[]
}> {}

/* ------------------------------------------------------------------ */
/* Dashboard inline                                                   */
/* ------------------------------------------------------------------ */
const COLOR_SCALE = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316']

function fmtInt(n?: number) { return typeof n === 'number' ? new Intl.NumberFormat('fr-FR').format(n) : '-' }

function StockMovementsDashboardInline({
  period,
  movementsChart,
  topMoving,
  recentMovements,
  categoryBalances
}: {
  period: string
  movementsChart: MovementsPoint[]
  topMoving: TopMoving[]
  recentMovements: RecentMovement[]
  categoryBalances: CategoryBalance[]
}) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>(period || '30')

  const handlePeriodChange = (newPeriod: string) => {
    setSelectedPeriod(newPeriod)
    router.get(route('stock-movements.report', { period: newPeriod }), {}, { preserveScroll: true, preserveState: true })
  }

  return (
    <div className="space-y-6">
      {/* Header avec sélecteur de période */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-blue-500 p-2 rounded-md">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              Analyse des mouvements
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mt-2">Tendances et activité détaillée</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="7">7 derniers jours</option>
              <option value="30">30 derniers jours</option>
              <option value="90">90 derniers jours</option>
              <option value="365">1 an</option>
            </select>
          </div>
        </div>
      </div>

      {/* Graphique + Top produits */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Mouvements par jour</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">Entrées, sorties, ajustements & net</p>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {Array.isArray(movementsChart) && movementsChart.length ? (
                <ComposedChart data={movementsChart}>
                  <CartesianGrid strokeDasharray="3 3" className="dark:stroke-slate-700" />
                  <XAxis dataKey="label" stroke="#64748b" className="dark:stroke-slate-400" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#64748b" className="dark:stroke-slate-400" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#64748b" className="dark:stroke-slate-400" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }} className="dark:!bg-slate-800 dark:!border-slate-700" />
                  <Area yAxisId="left" type="monotone" dataKey="in" stroke="#10B981" fill="#10B981" fillOpacity={0.15} name="Entrées" />
                  <Bar yAxisId="left" dataKey="out" fill="#EF4444" name="Sorties" />
                  <Bar yAxisId="left" dataKey="adjustments" fill="#F59E0B" name="Ajustements" />
                  <Line yAxisId="right" type="monotone" dataKey="net" stroke="#3B82F6" name="Net" />
                  <Legend />
                </ComposedChart>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">Aucune série temporelle disponible</div>
              )}
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
          className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Produits les plus mouvants</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">Top {Math.min(5, Math.max(1, topMoving?.length || 0))}</p>
            </div>
          </div>
          <div className="space-y-4">
            {topMoving?.length ? (
              topMoving.slice(0, 5).map((p, index) => (
                <div key={p.id ?? index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{p.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{p.sku ?? '—'} • Net {p.net >= 0 ? '+' : ''}{fmtInt(p.net)}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-green-600">+{fmtInt(p.in)} in</div>
                    <div className="text-red-600">-{fmtInt(p.out)} out</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">Aucun mouvement sur cette période</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Ligne du bas : Répartition catégories + Activité récente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Répartition par catégorie</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">Stock courant</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2"><PieIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" /></div>
          </div>
          {categoryBalances?.length ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryBalances} dataKey="stock" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                    {categoryBalances.map((_, i) => <Cell key={i} fill={COLOR_SCALE[i % COLOR_SCALE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [fmtInt(v), 'Stock']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">Aucune donnée catégorie</div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
          className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Activité récente</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">Derniers mouvements saisis</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2"><Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
          </div>
          <div className="space-y-3">
            {recentMovements?.length ? (
              recentMovements.slice(0, 10).map((m) => {
                const color = m.type === 'in' ? 'text-green-600' : m.type === 'out' ? 'text-red-600' : 'text-amber-600'
                const sign = m.type === 'in' ? '+' : m.type === 'out' ? '-' : ''
                return (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                        {m.type === 'in' ? <TrendingUp className="w-4 h-4 text-green-600" /> : m.type === 'out' ? <TrendingDown className="w-4 h-4 text-red-600" /> : <Equal className="w-4 h-4 text-amber-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{m.product_name}{m.sku ? ` • ${m.sku}` : ''}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{m.type}{m.reason ? ` • ${m.reason}` : ''}</p>
                      </div>
                    </div>
                    <div className={`text-sm font-semibold ${color}`}>{sign}{fmtInt(m.quantity)}</div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">Aucune activité récente</div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page Report                                                        */
/* ------------------------------------------------------------------ */
export default function StockReport({
  products,
  globalStats,
  period,
  kpis,
  movementsChart,
  topMoving,
  recentMovements,
  categoryBalances
}: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'good'>('all')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'in' | 'out'>('name')
  // ⬇️ NOUVEAU : filtre par type de mouvement (incluant ajustements)
  const [movementFilter, setMovementFilter] = useState<'all' | 'in' | 'out' | 'adjustments'>('all')

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { status: 'out', color: 'text-red-500', bgColor: 'bg-red-500', icon: XCircle }
    if (quantity < 10) return { status: 'low', color: 'text-yellow-500', bgColor: 'bg-yellow-500', icon: AlertTriangle }
    return { status: 'good', color: 'text-green-500', bgColor: 'bg-green-500', icon: CheckCircle }
  }

  const formatNumber = (num: number) => new Intl.NumberFormat('fr-FR').format(num)

  const categories = useMemo(() => {
    const cats = products.map(p => p.category?.name).filter(Boolean) as string[]
    return [...new Set(cats)]
  }, [products])

  // ⬇️ Bouton "Réinitialiser" : remet tous les filtres à zéro
  const handleResetFilters = () => {
    setSearchTerm('')
    setSelectedCategory('all')
    setStockFilter('all')
    setViewMode('table')
    setSortBy('name')
    setMovementFilter('all')
  }

  const resetToBaseFilters = () => {
    setStockFilter('all')
    setMovementFilter('all')
    setSortBy('name')
  }

  const filteredProducts = useMemo(() => {
    let filtered = [...products]

    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
      )
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category?.name === selectedCategory)
    }

    if (stockFilter !== 'all') {
      filtered = filtered.filter(p => getStockStatus(p.stock_quantity).status === stockFilter)
    }

    // ⬇️ Application du filtre de mouvement
    if (movementFilter === 'in') {
      filtered = filtered.filter(p => (p.total_in ?? 0) > 0)
    } else if (movementFilter === 'out') {
      filtered = filtered.filter(p => (p.total_out ?? 0) > 0)
    } else if (movementFilter === 'adjustments') {
      filtered = filtered.filter(p => (p.total_adjustments ?? 0) !== 0)
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'stock': return b.stock_quantity - a.stock_quantity
        case 'in':    return b.total_in - a.total_in
        case 'out':   return b.total_out - a.total_out
        default:      return a.name.localeCompare(b.name)
      }
    })

    return filtered
  }, [products, searchTerm, selectedCategory, stockFilter, sortBy, movementFilter])

  return (
    <>
      <Head title="Rapport des mouvements de stock" />

      <div className="min-h-screen bg-gradient-to-br from-white via-slate-100 to-slate-200 dark:from-[#0a0420] dark:via-[#0e0a32] dark:to-[#1B1749] transition-colors duration-500">
        <ParticlesBackground />

        <AppLayout
          breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Mouvements', href: '/stock-movements' },
            { title: 'Rapport', href: route('stock-movements.report') },
          ]}
        >
          <div className="p-6 space-y-6">
            {/* -------- En-tête avec actions -------- */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  Rapport des mouvements de stock
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2">
                  Vue d'ensemble complète des mouvements et niveaux de stock
                </p>
              </div>
              <div className="flex gap-3">
                <Link href={route('stock-movements.index')}>
                  <Button variant="outline" size="sm" className="bg-white/50 dark:bg-white/5 backdrop-blur-sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour
                  </Button>
                </Link>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 shadow-lg"
                  onClick={() => window.location.href = route('stock-movements.export')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exporter
                </Button>
              </div>
            </div>

            {/* -------- Métriques principales (MÊMES DIMENSIONS QUE DASHBOARD) -------- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              <MetricCard
                title="Produits totaux"
                value={globalStats.total_products}
                icon={Package2}
                color="from-blue-600 to-blue-500"
                trend="+5%"
                onClick={resetToBaseFilters}
                isActive={stockFilter === 'all' && movementFilter === 'all'}
              />
              <MetricCard
                title="Stock normal"
                value={globalStats.total_products - globalStats.low_stock_count - globalStats.out_of_stock_count}
                icon={CheckCircle}
                color="from-green-600 to-green-500"
                trend="+12%"
                onClick={() => { stockFilter === 'good' ? resetToBaseFilters() : (setStockFilter('good'), setMovementFilter('all')) }}
                isActive={stockFilter === 'good'}
              />
              <MetricCard
                title="Stock faible"
                value={globalStats.low_stock_count}
                icon={AlertTriangle}
                color="from-yellow-600 to-yellow-500"
                trend="-3%"
                onClick={() => { stockFilter === 'low' ? resetToBaseFilters() : (setStockFilter('low'), setMovementFilter('all')) }}
                isActive={stockFilter === 'low'}
              />
              <MetricCard
                title="Ruptures"
                value={globalStats.out_of_stock_count}
                icon={XCircle}
                color="from-red-600 to-red-500"
                trend="-8%"
                onClick={() => { stockFilter === 'out' ? resetToBaseFilters() : (setStockFilter('out'), setMovementFilter('all')) }}
                isActive={stockFilter === 'out'}
              />
              <MetricCard
                title="Total Stock"
                value={globalStats.total_stock}
                icon={Activity}
                color="from-slate-600 to-slate-500"
                trend="+2%"
              />
            </div>

            {/* -------- Métriques des mouvements (MÊMES DIMENSIONS QUE DASHBOARD) -------- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              <InteractiveMovementCard
                title="Entrées totales"
                value={globalStats.total_in}
                icon={TrendingUp}
                color="text-green-600"
                bgColor="from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20"
                description="Unités reçues"
                prefix="+"
                onClick={() => { movementFilter === 'in' ? resetToBaseFilters() : (setMovementFilter('in'), setSortBy('in'), setStockFilter('all')) }}
                isActive={movementFilter === 'in'}
              />
              <InteractiveMovementCard
                title="Sorties totales"
                value={globalStats.total_out}
                icon={TrendingDown}
                color="text-red-600"
                bgColor="from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20"
                description="Unités sorties"
                prefix="-"
                onClick={() => { movementFilter === 'out' ? resetToBaseFilters() : (setMovementFilter('out'), setSortBy('out'), setStockFilter('all')) }}
                isActive={movementFilter === 'out'}
              />
              <InteractiveMovementCard
                title="Ajustements"
                value={globalStats.total_adjustments}
                icon={Equal}
                color="text-blue-600"
                bgColor="from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20"
                description="Corrections appliquées"
                prefix={globalStats.total_adjustments >= 0 ? "+" : ""}
                onClick={() => { movementFilter === 'adjustments' ? resetToBaseFilters() : (setMovementFilter('adjustments'), setSortBy('name'), setStockFilter('all')) }}
                isActive={movementFilter === 'adjustments'}
              />
              <InteractiveMovementCard
                title="Mouvement Net"
                value={globalStats.total_in - globalStats.total_out + globalStats.total_adjustments}
                icon={Activity}
                color="text-slate-600"
                bgColor="from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/20"
                description="Variation totale"
                prefix={globalStats.total_in - globalStats.total_out + globalStats.total_adjustments >= 0 ? "+" : ""}
              />
            </div>

            {/* -------- Dashboard embarqué -------- */}
            {/* <div className="bg-white/60 dark:bg-white/5 backdrop-blur-md border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-4">
              <StockMovementsDashboardInline
                period={period}
                movementsChart={movementsChart}
                topMoving={topMoving}
                recentMovements={recentMovements}
                categoryBalances={categoryBalances}
              />
            </div> */}

            {/* -------- Filtres et contrôles -------- */}
            <Card className="bg-white/60 dark:bg-white/5 backdrop-blur-md border-slate-200 dark:border-slate-700 shadow-xl">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-4 flex-1">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <Input
                        placeholder="Rechercher un produit..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-white/50 dark:bg-white/5 border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-48 bg-white/50 dark:bg-white/5 border-slate-200 dark:border-slate-700">
                        <SelectValue placeholder="Toutes catégories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes catégories</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                      <SelectTrigger className="w-48 bg-white/50 dark:bg-white/5 border-slate-200 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Nom A-Z</SelectItem>
                        <SelectItem value="stock">Stock (élevé)</SelectItem>
                        <SelectItem value="in">Entrées (élevé)</SelectItem>
                        <SelectItem value="out">Sorties (élevé)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Bouton de réinitialisation */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetFilters}
                      className="bg-white/50 dark:bg-white/5"
                    >
                      Réinitialiser
                    </Button>
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('table')}
                      className={viewMode === 'table' ? 'bg-gradient-to-r from-blue-600 to-blue-500' : ''}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'cards' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('cards')}
                      className={viewMode === 'cards' ? 'bg-gradient-to-r from-blue-600 to-blue-500' : ''}
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* -------- Affichage des données -------- */}
            {viewMode === 'table' ? (
              <Card className="bg-white/60 dark:bg-white/5 backdrop-blur-md border-slate-200 dark:border-slate-700 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm">
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300">Produit</th>
                        <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300">Catégorie</th>
                        <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300">Stock</th>
                        <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300">Entrées</th>
                        <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300">Sorties</th>
                        <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300">Ajustements</th>
                        <th className="text-center p-4 font-semibold text-slate-700 dark:text-slate-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map(product => {
                        const stockStatus = getStockStatus(product.stock_quantity)
                        const StatusIcon = stockStatus.icon

                        return (
                          <tr key={product.id} className="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all duration-200">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-lg flex items-center justify-center shadow-sm">
                                  <Package2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900 dark:text-white">{product.name}</div>
                                  {product.sku && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{product.sku}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              {product.category?.name ? (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
                                  {product.category.name}
                                </Badge>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <StatusIcon className={`w-4 h-4 ${stockStatus.color}`} />
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {formatNumber(product.stock_quantity)}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <span className="text-green-600 font-semibold">+{formatNumber(product.total_in)}</span>
                            </td>
                            <td className="p-4 text-right">
                              <span className="text-red-600 font-semibold">-{formatNumber(product.total_out)}</span>
                            </td>
                            <td className="p-4 text-right">
                              <span className={`font-semibold ${product.total_adjustments >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                {product.total_adjustments > 0 ? '+' : ''}{formatNumber(product.total_adjustments)}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <Link href={`/products/${product.id}`}>
                                <Button variant="ghost" size="sm" className="hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                  <Eye className="w-4 h-4 text-blue-600" />
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(product => {
                  const stockStatus = getStockStatus(product.stock_quantity)
                  const StatusIcon = stockStatus.icon

                  return (
                    <Card key={product.id} className="bg-white/60 dark:bg-white/5 backdrop-blur-md border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-xl flex items-center justify-center shadow-sm">
                              <Package2 className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                            </div>
                            <div>
                              <CardTitle className="text-base text-slate-900 dark:text-white leading-tight">{product.name}</CardTitle>
                              {product.sku && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{product.sku}</p>
                              )}
                            </div>
                          </div>
                          {product.category?.name && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-medium">
                              {product.category.name}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Stock actuel</span>
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`w-4 h-4 ${stockStatus.color}`} />
                            <span className="font-bold text-slate-900 dark:text-white">{formatNumber(product.stock_quantity)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 bg-green-50/50 dark:bg-green-900/20 rounded-lg">
                            <div className="text-lg font-bold text-green-600">+{formatNumber(product.total_in)}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Entrées</div>
                          </div>
                          <div className="text-center p-3 bg-red-50/50 dark:bg-red-900/20 rounded-lg">
                            <div className="text-lg font-bold text-red-600">-{formatNumber(product.total_out)}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sorties</div>
                          </div>
                          <div className="text-center p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg">
                            <div className={`text-lg font-bold ${product.total_adjustments >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                              {product.total_adjustments > 0 ? '+' : ''}{formatNumber(product.total_adjustments)}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Ajust.</div>
                          </div>
                        </div>

                        <Link href={`/products/${product.id}`}>
                          <Button variant="outline" size="sm" className="w-full mt-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300">
                            <Eye className="w-4 h-4 mr-2" />
                            Voir détails
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {filteredProducts.length === 0 && (
              <Card className="bg-white/60 dark:bg-white/5 backdrop-blur-md border-slate-200 dark:border-slate-700 shadow-xl">
                <CardContent className="text-center py-16">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package2 className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                    {stockFilter === 'low' ? 'Aucun produit en stock faible' :
                     stockFilter === 'out' ? 'Aucune rupture de stock' :
                     stockFilter === 'good' ? 'Aucun produit avec stock normal' :
                     movementFilter === 'in' ? 'Aucun produit avec des entrées' :
                     movementFilter === 'out' ? 'Aucun produit avec des sorties' :
                     movementFilter === 'adjustments' ? 'Aucun produit avec ajustements' :
                     'Aucun produit trouvé'}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    {stockFilter !== 'all' || movementFilter !== 'all' ?
                      'Cliquez sur "Réinitialiser" pour voir tous les produits.' :
                      'Essayez de modifier vos critères de recherche ou de filtrage.'}
                  </p>
                  {(stockFilter !== 'all' || movementFilter !== 'all') && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={handleResetFilters}
                    >
                      Réinitialiser
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </AppLayout>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* UI helpers                                                         */
/* ------------------------------------------------------------------ */
interface MetricCardProps {
  title: string
  value: number
  icon: React.ElementType
  color: string
  trend?: string
  onClick?: () => void
  isActive?: boolean
}

const MetricCard = ({ title, value, icon: Icon, color, trend, onClick, isActive }: MetricCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay: 0 }}
    className={`relative overflow-hidden rounded-xl shadow-xl p-4 text-white bg-gradient-to-br ${color} hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer ${
      isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''
    }`}
    onClick={onClick}
  >
    <p className="text-white/80 text-xs font-medium mb-1">{title}</p>
    <div className="flex items-center justify-between gap-3">
      <p className="text-xl font-bold">{new Intl.NumberFormat('fr-FR').format(value)}</p>
      <div className="shrink-0">
        <div className="bg-white/20 rounded-lg p-2">
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>

    {trend && (
      <div className="mt-2 flex items-center gap-2">
        <div className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white/20 text-white">
          <TrendingUp className="w-3 h-3" />
          {trend} vs mois dernier
        </div>
      </div>
    )}

    {isActive && (
      <p className="text-xs text-white/90 mt-1 font-medium">
        Filtre actif
      </p>
    )}

    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
  </motion.div>
)

interface InteractiveMovementCardProps {
  title: string
  value: number
  icon: React.ElementType
  color: string
  bgColor: string
  description: string
  prefix?: string
  onClick?: () => void
  isActive?: boolean
}

const InteractiveMovementCard = ({ title, value, icon: Icon, color, bgColor, description, prefix = '', onClick, isActive }: InteractiveMovementCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay: 0.05 }}
    className={`relative overflow-hidden rounded-xl shadow-xl p-4 text-white bg-gradient-to-br ${bgColor.includes('slate') ? 'from-slate-600 to-slate-500' : bgColor.includes('green') ? 'from-green-600 to-green-500' : bgColor.includes('red') ? 'from-red-600 to-red-500' : 'from-blue-600 to-blue-500'} hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 ${
      onClick ? 'cursor-pointer' : ''
    } ${isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''}`}
    onClick={onClick}
  >
    <p className="text-white/80 text-xs font-medium mb-1 flex items-center gap-2">
      <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
        <Icon className="w-3 h-3 text-white" />
      </div>
      {title}
    </p>

    <div className="text-xl font-bold text-white mb-1">
      {prefix}{new Intl.NumberFormat('fr-FR').format(value)}
    </div>

    <p className="text-xs text-white/70">
      {description}
    </p>

    {isActive && (
      <p className="text-xs text-white/90 mt-2 font-medium">
        Tri actif
      </p>
    )}

    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
  </motion.div>
)
