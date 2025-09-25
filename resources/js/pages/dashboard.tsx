import React, { useEffect, useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { route } from 'ziggy-js';
import AppLayout from '@/layouts/app-layout';
import ParticlesBackground from '@/components/ParticlesBackground';
import { motion } from 'framer-motion';
import {
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  TrendingUp,
  Package,
  Activity,
  PieChart as PieIcon,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  BarChart3,
  CheckCircle,
  X,
  Percent,
  Clock,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

/**
 * =============================================================
 *  DASHBOARD ANALYTICS — Fusion Bolt + Ancien Layout/AppShell
 *  + Ajout variation YoY (même période N‑1)
 * =============================================================
 */

const COLOR_SCALE = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];
const SIMPLE_COLORS = ['#dc2626', '#0891b2', '#059669', '#d97706', '#7c3aed'];

// --- Types compacts compatibles (mix des 2 versions) ---
interface KPI {
  value?: number;
  formatted?: string;
  change?: number; // compat: variation vs période précédente (ancienne clé)
  total?: number;
  // Nouvelles clés pour YoY propre
  previous?: number; // période précédente
  previous_yoy?: number; // même période N‑1
  change_period?: number; // variation vs période précédente
  change_yoy?: number; // variation vs N‑1
  formatted_previous?: string;
  formatted_previous_yoy?: string;
}
interface KPIsCompat {
  revenue: KPI & { value?: number };
  orders: KPI & { value?: number };
  newClients: KPI & { value?: number };
  outOfStock: KPI & { value?: number } | number;
}

interface SalesChartItem { date: string; label: string; revenue: number; orders: number; quotes?: number }
interface TopProduct { id: string | number; name: string; sku: string; quantity: number; revenue?: number; formatted_revenue?: string }
interface StockItem { id: string | number; name: string; sku: string; stock_quantity?: number; low_stock_threshold?: number; category?: { name: string } }
interface StockAlerts { lowStock: StockItem[]; outOfStock: StockItem[] }
interface RecentActivityItem { type?: 'order'|'quote'|string; title: string; description?: string; amount: number; status?: string; created_at?: string }
interface CategoryDistributionItem { name: string; productCount?: number; totalStock?: number; stockValue?: number; formattedValue?: string }
interface QuoteConversionRate { rate: number; total: number; converted: number; breakdown?: Record<string, number> }

// Blocs avancés (tous optionnels)
interface SalesMetrics { averageOrderValue?: { value: number; formatted: string }; monthlyGrowth?: { current: number; previous: number; growth: number; formatted_current?: string; formatted_previous?: string }; salesChannels?: { quote_based: number; direct: number; total: number }; avgConversionTime?: number }
interface ClientMetrics { activeClients?: number; retentionRate?: number; topClients?: Array<{ id: number; company_name: string; total_spent: number; orders_count: number }>; clientsByCity?: Array<{ city: string; count: number }> }
interface InventoryMetrics { totalStockValue?: { value: number; formatted: string }; stockTurnover?: number; topMovingProducts?: Array<{ id: string; name: string; total_sold: number }>; slowMovingProducts?: Array<{ id: string; name: string; stock_quantity: number }>; lowStockCount?: number }
interface FinancialMetrics { grossMargin?: number; totalCost?: { value: number; formatted: string }; overdueInvoices?: { count: number; amount: number; formatted: string }; monthlyRevenue?: Array<{ month: string; label: string; revenue: number }> }
interface PerformanceMetrics { avgProcessingTime?: number; cancellationRate?: number; mostViewedProducts?: Array<{ name: string; sku: string; views: number }>; orderStatusEvolution?: Array<{ status: string; count: number }> }
interface TrendsData { dailyMetrics?: Array<{ date: string; label: string; revenue: number; orders: number; quotes?: number }>; categoryRevenue?: Array<{ name: string; revenue: number; formatted?: string }> }
interface HeatmapData { salesHeatmap?: Array<{ day_of_week: number; hour: number; orders_count: number; revenue: number }>; brandCategoryMatrix?: Array<{ brand_name: string; category_name: string; revenue: number; quantity: number }> }

interface Flash { success?: string; error?: string }

interface Props {
  kpis: KPIsCompat;
  salesChart: SalesChartItem[];
  topProducts: TopProduct[];
  stockAlerts: StockAlerts;
  recentActivity: RecentActivityItem[];
  categoryDistribution?: CategoryDistributionItem[];
  quoteConversionRate?: QuoteConversionRate;
  period: string;
  // avancé optionnel
  salesMetrics?: SalesMetrics;
  clientMetrics?: ClientMetrics;
  inventoryMetrics?: InventoryMetrics;
  financialMetrics?: FinancialMetrics;
  performanceMetrics?: PerformanceMetrics;
  trendsData?: TrendsData;
  heatmapData?: HeatmapData;
  flash?: Flash;
}

// Helpers
const fmtMAD = (n: number | undefined) =>
  typeof n === 'number' ? new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n) : '-';

const pctBadge = (change?: number) => {
  if (typeof change !== 'number') return null;
  const up = change > 0; const flat = change === 0;
  return (
    <div className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${up ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200' : flat ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'}`}>
      {up ? <ArrowUpRight className="w-3 h-3"/> : flat ? null : <ArrowDownRight className="w-3 h-3"/>}
      {`${up ? '+' : ''}${change.toFixed(1)}%`}
    </div>
  );
};

/** Composant réutilisable pour homogénéiser les cartes KPI */
type StatCardProps = {
  label: string;
  value: React.ReactNode;
  change?: number | string; // conserve pour compat
  icon: React.ElementType;
  gradient: string;
  delay?: number;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
};
const StatCard = ({ label, value, change, icon: Icon, gradient, delay = 0, subtitle, footer }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay }}
    className={`relative overflow-hidden rounded-xl shadow-xl p-4 text-white bg-gradient-to-br ${gradient} hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1`}
  >
    <p className="text-white/80 text-xs font-medium mb-1">{label}</p>
    <div className="flex items-center justify-between gap-3">
      <p className="text-xl font-bold">{value}</p>
      <div className="shrink-0">
        <div className="bg-white/20 rounded-lg p-2">
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>

    {subtitle && (
      <div className="mt-1 text-xs text-white/85 flex flex-col gap-1">
        {subtitle}
      </div>
    )}

    {typeof change !== 'undefined' && change !== null && (
      <div className="mt-2 flex items-center gap-2">
        {typeof change === 'number' ? pctBadge(change) : change}
      </div>
    )}

    {footer && <p className="text-[11px] text-white/70 mt-2">{footer}</p>}
    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
  </motion.div>
);

export default function DashboardAnalytics(props: Props) {
  const {
    kpis,
    salesChart,
    topProducts,
    stockAlerts,
    recentActivity,
    categoryDistribution = [],
    quoteConversionRate,
    period,
    salesMetrics,
    clientMetrics,
    inventoryMetrics,
    financialMetrics,
    performanceMetrics,
    trendsData,
    heatmapData,
    flash,
  } = props;

  // Auth context
  const { props: { auth } } = usePage<any>();
  const roles: string[] = auth?.roles ?? [];
  const perms: string[] = auth?.permissions ?? [];
  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('super-admin');
  const can = (p: string) => isSuperAdmin || perms.includes(p);

  const [selectedPeriod, setSelectedPeriod] = useState<string>(period || '30');
  const [showSuccess, setShowSuccess] = useState(!!flash?.success);
  const [showError, setShowError] = useState(!!flash?.error);

  const revenueFormatted = kpis.revenue.formatted ?? (typeof kpis.revenue.value === 'number' ? fmtMAD(kpis.revenue.value) : '-');
  const ordersValue = (kpis.orders.value ?? 0);
  const newClientsValue = (kpis.newClients.value ?? 0);
  const outOfStockValue = typeof kpis.outOfStock === 'number' ? kpis.outOfStock : (kpis.outOfStock?.value ?? 0);

  // Variations (compat: on retombe sur l'ancienne clé `change`)
  const revenueChangePeriod = (typeof kpis.revenue.change_period === 'number') ? kpis.revenue.change_period : kpis.revenue.change;
  const revenueChangeYoY = kpis.revenue.change_yoy;

  const handlePeriodChange = (newPeriod: string) => {
    setSelectedPeriod(newPeriod);
    const url = route('dashboard.index', { period: newPeriod });
    router.get(url, {}, { preserveScroll: true, preserveState: true });
  };

  // Auto-dismiss flash
  useEffect(() => {
    if (flash?.success) {
      setShowSuccess(true);
      const t = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(t);
    }
  }, [flash?.success]);
  useEffect(() => {
    if (flash?.error) {
      setShowError(true);
      const t = setTimeout(() => setShowError(false), 5000);
      return () => clearTimeout(t);
    }
  }, [flash?.error]);

  const dailyMetrics = trendsData?.dailyMetrics ?? salesChart;

  const outOfStockObj = (kpis as any)?.outOfStock;
  const outOfStockFooter =
    typeof outOfStockObj === 'object' && outOfStockObj?.total
      ? <>sur {outOfStockObj.total} produits suivis</>
      : null;

  return (
    <>
      <Head title="Dashboard Analytics" />
      <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }]}>
        <div className="relative">
          <ParticlesBackground />
          <div className="relative z-10 w-full py-6 px-4">
            {/* Flash */}
            {flash?.success && showSuccess && (
              <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 flex items-start gap-3 dark:bg-green-900 dark:border-green-700 dark:text-green-100">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1 font-medium">{flash.success}</span>
                <button onClick={() => setShowSuccess(false)}><X className="w-4 h-4" /></button>
              </div>
            )}
            {flash?.error && showError && (
              <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 dark:bg-red-900 dark:border-red-700 dark:text-red-100">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1 font-medium">{flash.error}</span>
                <button onClick={() => setShowError(false)}><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* Header */}

            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6 mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="bg-gradient-to-br from-red-600 to-red-500 p-2">
                      {/* <BarChart3 className="w-8 h-8 text-white" /> */}
                    </div>
                    Dashboard Analytics
                  </h1>
                  <p className="text-slate-600 dark:text-slate-300 mt-2">Vue d'ensemble de votre activité commerciale</p>
                </div>
                {/* <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-500" />
                  <select
                    value={selectedPeriod}
                    onChange={(e) => handlePeriodChange(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                  >
                    <option value="7">7 derniers jours</option>
                    <option value="30">30 derniers jours</option>
                    <option value="90">90 derniers jours</option>
                    <option value="365">1 an</option>
                  </select>
                </div> */}
              </div>
            </div>

            {/* KPI row (5 cartes) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              {/* C.A */}
              <StatCard
                label="Chiffre d'affaires"
                value={revenueFormatted}
                icon={DollarSign}
                gradient="from-red-600 to-red-500"
                delay={0}
                subtitle={
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px]">vs période précédente</span>
                      {pctBadge(revenueChangePeriod)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px]">vs même période N‑1</span>
                      {pctBadge(revenueChangeYoY)}
                    </div>
                  </>
                }
              />

              {/* Commandes */}
              <StatCard
                label="Commandes"
                value={ordersValue}
                change={kpis.orders?.change}
                icon={ShoppingCart}
                gradient="from-blue-600 to-cyan-600"
                delay={0.05}
              />

              {/* Nouveaux clients */}
              <StatCard
                label="Nouveaux Clients"
                value={newClientsValue}
                change={kpis.newClients?.change}
                icon={Users}
                gradient="from-green-600 to-teal-600"
                delay={0.1}
              />

              {/* Produits en rupture */}
              <StatCard
                label="Produits en Rupture"
                value={outOfStockValue}
                change={typeof outOfStockObj === 'object' ? outOfStockObj?.change : undefined}
                icon={AlertTriangle}
                gradient="from-orange-600 to-yellow-600"
                delay={0.15}
                footer={outOfStockFooter}
              />

              {/* Taux conversion devis */}
              <StatCard
                label="Taux Conversion"
                value={quoteConversionRate ? `${quoteConversionRate.rate}%` : '--'}
                icon={TrendingUp}
                gradient="from-purple-600 to-indigo-600"
                delay={0.2}
                subtitle={
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-xs font-medium text-purple-200">Devis convertis</span>
                  </span>
                }
              />
            </div>

            {/* Row: Ventes + Top produits */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
                className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Évolution des Ventes</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Revenus, commandes et devis</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2"><TrendingUp className="w-4 h-4 text-red-600 dark:text-red-400" /></div>
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dailyMetrics}>
                      <CartesianGrid strokeDasharray="3 3" className="dark:stroke-slate-700" />
                      <XAxis dataKey="label" stroke="#64748b" className="dark:stroke-slate-400" fontSize={12} />
                      <YAxis yAxisId="left" stroke="#64748b" className="dark:stroke-slate-400" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" stroke="#64748b" className="dark:stroke-slate-400" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }} className="dark:!bg-slate-80 0 dark:!border-slate-700" />
                      <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#10B981" fill="#10B981" fillOpacity={0.15} name="Revenus" />
                      <Bar yAxisId="right" dataKey="orders" fill="#3B82F6" name="Commandes" />
                      <Line yAxisId="right" type="monotone" dataKey="quotes" stroke="#F59E0B" name="Devis" />
                      <Legend />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
                className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Produits Populaires</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Top {Math.min(5, Math.max(1, topProducts?.length || 0))} des meilleures ventes</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2"><Package className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
                </div>
                <div className="space-y-4">
                  {topProducts?.length ? (
                    topProducts.slice(0, 5).map((product, index) => (
                      <div key={product.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-red-600 dark:text-red-400">#{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{product.name}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{product.sku} • {product.quantity} vendus</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{product.formatted_revenue ?? (product.revenue ? fmtMAD(product.revenue) : '-') }</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">Aucune vente pour cette période</div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Ligne du bas : Alertes, Activité, Catégories + Conversion */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Alertes stock */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Alertes de Stock</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Produits nécessitant attention</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2"><AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
                </div>
                <div className="space-y-4">
                  {stockAlerts?.lowStock?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Stock Faible</h4>
                      <div className="space-y-2">
                        {stockAlerts.lowStock.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{item.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{item.category?.name ? `${item.category.name} • ` : ''}{item.sku}</p>
                            </div>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              {item.stock_quantity ?? 0}{item.low_stock_threshold ? ` / ${item.low_stock_threshold}` : ' restant'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stockAlerts?.outOfStock?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Rupture de Stock</h4>
                      <div className="space-y-2">
                        {stockAlerts.outOfStock.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{item.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{item.category?.name ? `${item.category.name} • ` : ''}{item.sku}</p>
                            </div>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Épuisé</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!stockAlerts?.lowStock?.length && !stockAlerts?.outOfStock?.length) && (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                      Aucune alerte de stock
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Activité récente */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
                className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Activité Récente</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Dernières commandes / devis</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2"><Activity className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
                </div>
                <div className="space-y-3">
                  {recentActivity?.length ? (
                    recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                            <ShoppingCart className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{activity.title}</p>
                            {activity.type && <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{activity.type}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{fmtMAD(activity.amount)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">Aucune activité récente</div>
                  )}
                </div>
              </motion.div>

              {/* Répartition Catégories + Conversion devis */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
                className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Répartition des Catégories</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Distribution des produits</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2"><PieIcon className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
                </div>
                {categoryDistribution?.length ? (
                  <div className="space-y-3 mb-6">
                    {categoryDistribution.map((c, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SIMPLE_COLORS[idx % SIMPLE_COLORS.length] }} />
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</span>
                        </div>
                        <div className="text-right">
                          {typeof c.stockValue === 'number' ? (
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.formattedValue ?? fmtMAD(c.stockValue)}</p>
                          ) : (
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.productCount ?? 0}</p>
                          )}
                          {typeof c.totalStock === 'number' && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{c.totalStock} en stock</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-500 dark:text-slate-400 mb-6">Aucune catégorie trouvée</div>
                )}

                {quoteConversionRate && (
                  <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Taux de Conversion Devis</span>
                      <span className="text-lg font-bold text-red-600 dark:text-red-400">{quoteConversionRate.rate}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${quoteConversionRate.rate}%` }} transition={{ duration: 1 }} className="bg-gradient-to-r from-red-500 to-red-600 h-2 rounded-full" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{quoteConversionRate.converted} convertis sur {quoteConversionRate.total} devis</p>
                  </div>
                )}
              </motion.div>
            </div>

            {/* --- Section avancée (facultative) : Finance mensuelle --- */}
            {financialMetrics?.monthlyRevenue?.length ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Évolution mensuelle (12 mois)</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Chiffre d'affaires</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2"><Percent className="w-5 h-5 text-slate-600 dark:text-slate-300" /></div>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={financialMetrics.monthlyRevenue}>
                        <CartesianGrid strokeDasharray="3 3" className="dark:stroke-slate-700" />
                        <XAxis dataKey="label" stroke="#64748b" className="dark:stroke-slate-400" fontSize={12} />
                        <YAxis stroke="#64748b" className="dark:stroke-slate-400" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }} className="dark:!bg-slate-800 dark:!border-slate-700" formatter={(value: any) => [fmtMAD(value), 'Revenus']} />
                        <Area type="monotone" dataKey="revenue" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Répartition valeur stock si fournie */}
                {categoryDistribution.some(c => typeof c.stockValue === 'number') && (
                  <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Valeur du stock par catégorie</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Répartition</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2"><PieIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" /></div>
                    </div>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryDistribution.filter(c=> typeof c.stockValue === 'number')} dataKey="stockValue" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                            {categoryDistribution.map((_, i) => <Cell key={i} fill={COLOR_SCALE[i % COLOR_SCALE.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => [fmtMAD(v), 'Valeur stock']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </AppLayout>
    </>
  );
}
