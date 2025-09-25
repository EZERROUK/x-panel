import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { PageProps, Product, ProductFilterType, ProductFilters, Pagination } from '@/types';
import AppLayout from '@/layouts/app-layout';
import ParticlesBackground from '@/components/ParticlesBackground';
import ModernDatePicker from '@/components/ModernDatePicker';
import { Button } from '@/components/ui/button';
import {
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  RotateCcw,
  ChevronDown,
  Filter,
  X,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle,
  Search,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Package,
  Clock,
  Layers,
  DollarSign,
  Archive,
} from 'lucide-react';

interface Flash { success?: string; error?: string; }

interface Props extends PageProps<{
  products: Pagination<Product>;
  filters: ProductFilters;
  sort: 'name' | 'status' | 'created_at' | 'price' | 'stock_quantity';
  dir: 'asc' | 'desc';
  flash?: Flash;
}> {}

/** YYYY-MM-DD (local) */
const formatDateToYMD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
/** parse YYYY-MM-DD (local) */
const parseDateFromYMD = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/* -------------------------- QS helper (safe 1-arg router.get) -------------------------- */
function toQueryString(payload: Record<string, unknown>): string {
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    params.append(k, String(v));
  });
  return params.toString();
}

export default function ProductsIndex({ products, filters, sort, dir, flash }: Props) {
  /* ------------------------------ AUTH (Spatie) ------------------------------ */
  const { props: { auth } } = usePage<PageProps<any>>();
  const roles: string[] = (auth as any)?.roles ?? [];
  const perms: string[] = (auth as any)?.permissions ?? [];
  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('super-admin');
  const can = (p: string) => isSuperAdmin || perms.includes(p);

  const canCreate  = can('product_create');
  const canShow    = can('product_show');
  const canEdit    = can('product_edit');
  const canDelete  = can('product_delete');
  const canRestore = can('product_restore');

  const showActionsCol = canShow || canEdit || canDelete || canRestore;
  const showSelectCol  = canDelete || canRestore;

  /* ------------------------------ UI STATE ------------------------------ */
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [currentFilterField, setCurrentFilterField] = useState<ProductFilterType['field']>('search');
  const [currentFilterValue, setCurrentFilterValue] = useState('');
  const [currentFilterOperator, setCurrentFilterOperator] = useState<ProductFilterType['operator']>('contains');
  const [currentFilterValue2, setCurrentFilterValue2] = useState('');

  const [activeFilters, setActiveFilters] = useState<ProductFilterType[]>(() => {
    const arr: ProductFilterType[] = [];
    if (filters.search) filters.search.split(/\s+/).forEach((v) => arr.push({ field: 'search', value: v, operator: 'contains' }));
    if (filters.name)     arr.push({ field: 'name',     value: filters.name,     operator: 'contains' });
    if (filters.category) arr.push({ field: 'category', value: filters.category, operator: 'contains' });
    if (filters.status)   arr.push({ field: 'status',   value: filters.status,   operator: 'equals' });

    if (filters.price && filters.price_operator) {
      if (filters.price_operator === 'between' && filters.price_min && filters.price_max) {
        arr.push({ field: 'price', value: filters.price_min, value2: filters.price_max, operator: 'between' });
      } else {
        arr.push({ field: 'price', value: filters.price, operator: filters.price_operator as ProductFilterType['operator'] });
      }
    }
    if (filters.stock && filters.stock_operator) {
      if (filters.stock_operator === 'between' && filters.stock_min && filters.stock_max) {
        arr.push({ field: 'stock', value: filters.stock_min, value2: filters.stock_max, operator: 'between' });
      } else {
        arr.push({ field: 'stock', value: filters.stock, operator: filters.stock_operator as ProductFilterType['operator'] });
      }
    }
    if (filters.date_start && filters.date_end) {
      arr.push({ field: 'date', value: filters.date_start, value2: filters.date_end, operator: 'date_range' });
    }
    return arr;
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(!!flash?.success);
  const [showError, setShowError] = useState(!!flash?.error);

  const [startDate, setStartDate] = useState<Date | null>(filters.date_start ? parseDateFromYMD(filters.date_start) : null);
  const [endDate, setEndDate]     = useState<Date | null>(filters.date_end   ? parseDateFromYMD(filters.date_end)   : null);

  /* -------------------------- Flash auto-dismiss ------------------------ */
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

  /* ------------------------- Inertia helpers --------------------------- */
  const buildQueryPayload = (filtersList: ProductFilterType[], extra: Record<string, any> = {}) => {
    const payload: Record<string, any> = { ...extra };
    filtersList.forEach(filter => {
      switch (filter.field) {
        case 'search': {
          const terms = filtersList.filter(f => f.field === 'search').map(f => f.value).join(' ');
          if (terms) payload.search = terms;
          break;
        }
        case 'name':     payload.name     = filter.value; break;
        case 'category': payload.category = filter.value; break;
        case 'status':   payload.status   = filter.value; break;
        case 'price':
          if (filter.operator === 'between' && filter.value2) {
            payload.price_min = filter.value; payload.price_max = filter.value2; payload.price_operator = 'between';
          } else {
            payload.price = filter.value; payload.price_operator = filter.operator;
          }
          break;
        case 'stock':
          if (filter.operator === 'between' && filter.value2) {
            payload.stock_min = filter.value; payload.stock_max = filter.value2; payload.stock_operator = 'between';
          } else {
            payload.stock = filter.value; payload.stock_operator = filter.operator;
          }
          break;
        case 'date':
          if (filter.operator === 'date_range' && filter.value2) {
            payload.date_start = filter.value; payload.date_end = filter.value2;
          }
          break;
      }
    });
    return payload;
  };

  const go = (filtersList: ProductFilterType[], extra: Record<string, any> = {}) => {
    const payload = buildQueryPayload(filtersList, extra);
    const base = route('products.index');
    const qs = toQueryString(payload);
    const url = qs ? `${base}?${qs}` : base;
    router.get(url); // 1 seul argument => compatible
  };

  /* --------------------------- Filters CRUD ---------------------------- */
  const addFilter = () => {
    if (currentFilterField === 'date') {
      if (startDate && endDate) {
        const newFilter: ProductFilterType = {
          field: 'date',
          value: formatDateToYMD(startDate),
          value2: formatDateToYMD(endDate),
          operator: 'date_range',
        };
        const next = [...activeFilters.filter(f => f.field !== 'date'), newFilter];
        setActiveFilters(next);
        go(next, { page: 1, per_page: products.per_page, sort, dir });
      }
      return;
    }

    if (currentFilterOperator === 'between') {
      if (currentFilterValue && currentFilterValue2) {
        const newFilter: ProductFilterType = {
          field: currentFilterField,
          value: currentFilterValue,
          value2: currentFilterValue2,
          operator: 'between',
        };
        const next = [...activeFilters.filter(f => f.field !== currentFilterField), newFilter];
        setActiveFilters(next);
        setCurrentFilterValue('');
        setCurrentFilterValue2('');
        go(next, { page: 1, per_page: products.per_page, sort, dir });
      }
      return;
    }

    if (currentFilterValue) {
      const newFilter: ProductFilterType = {
        field: currentFilterField,
        value: currentFilterValue,
        operator: currentFilterOperator,
      };
      const next = [...activeFilters.filter(f => f.field !== currentFilterField), newFilter];
      setActiveFilters(next);
      setCurrentFilterValue('');
      go(next, { page: 1, per_page: products.per_page, sort, dir });
    }
  };

  const removeFilter = (idx: number) => {
    const f = activeFilters[idx];
    if (f.field === 'date') { setStartDate(null); setEndDate(null); }
    const next = activeFilters.filter((_, i) => i !== idx);
    setActiveFilters(next);
    go(next, { page: 1, per_page: products.per_page, sort, dir });
  };

  const resetFilters = () => {
    setActiveFilters([]); setStartDate(null); setEndDate(null);
    setCurrentFilterValue(''); setCurrentFilterValue2('');
    const base = route('products.index');
    const qs = toQueryString({ page: 1, per_page: products.per_page });
    router.get(`${base}?${qs}`);
  };

  /* ----------------------- Pagination & Tri --------------------------- */
  const changePage = (p: number) => go(activeFilters, { page: p, per_page: products.per_page, sort, dir });
  const changePer  = (n: number)   => go(activeFilters, { page: 1, per_page: n,             sort, dir });
  const changeSort = (field: 'name' | 'status' | 'created_at' | 'price' | 'stock_quantity') => {
    const newDir = sort === field ? (dir === 'asc' ? 'desc' : 'asc') : 'asc';
    go(activeFilters, { page: 1, per_page: products.per_page, sort: field, dir: newDir });
  };

  /* ---------------------------- Selection ----------------------------- */
  const toggleSelect = (id: string) =>
    setSelectedIds((p) => (p.includes(id) ? p.filter((i) => i !== id) : [...p, id]));
  const toggleSelectAll = () => {
    const ids = products.data.map((p) => p.id);
    setSelectedIds((p) => (p.length === ids.length ? [] : ids));
  };

  const anyInactive = selectedIds.some((id) => products.data.find((p) => p.id === id)?.deleted_at);
  const anyActive   = selectedIds.some((id) => !products.data.find((p) => p.id === id)?.deleted_at);

  /* ---------------------- Bulk actions (gated) ---------------------- */
  const restoreSelected = () => {
    if (!canRestore || !selectedIds.length) return;
    if (!confirm(`Restaurer ${selectedIds.length} produit(s) ?`)) return;
    selectedIds.forEach((id) => {
      router.post(route('products.restore', { id })); // 1 arg
    });
    setSelectedIds([]);
  };
  const deleteSelected = () => {
    if (!canDelete || !selectedIds.length) return;
    if (!confirm(`Supprimer ${selectedIds.length} produit(s) ?`)) return;
    selectedIds.forEach((id) => {
      router.delete(route('products.destroy', { id })); // 1 arg
    });
    setSelectedIds([]);
  };

  /* -------------------- Pagination window -------------------- */
  const windowPages = useMemo<(number | '…')[]>(() => {
    const pages: (number | '…')[] = [];
    const MAX = 5;
    const c = products.current_page;
    const l = products.last_page;

    if (l <= MAX + 2) { for (let i = 1; i <= l; i++) pages.push(i); return pages; }

    pages.push(1);
    let start = Math.max(2, c - Math.floor(MAX / 2));
    let end = start + MAX - 1;
    if (end >= l) { end = l - 1; start = end - MAX + 1; }
    if (start > 2) pages.push('…');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < l - 1) pages.push('…');
    pages.push(l);
    return pages;
  }, [products.current_page, products.last_page]);

  /* ----------------------------- RENDER ----------------------------- */
  return (
    <>
      <Head title="Produits" />
      <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Produits', href: '/products' }]}>
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

            {/* Outils + filtres */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl p-6 mb-6 relative z-50">
              <div className="flex flex-wrap gap-4 justify-between">
                {/* Bloc filtres */}
                <div className="flex flex-col gap-4 w-full lg:w-auto">
                  <div className="flex items-center gap-3">
                    <Button onClick={() => setShowFilterPanel(!showFilterPanel)}>
                      <Filter className="w-4 h-4" />
                      {showFilterPanel ? 'Masquer les filtres' : 'Afficher les filtres'}
                    </Button>

                    {activeFilters.length > 0 && (
                      <Button variant="outline" onClick={resetFilters} className="gap-1.5">
                        <X className="w-4 h-4" /> Effacer
                      </Button>
                    )}

                    {showSelectCol && selectedIds.length > 0 && (
                      <>
                        {anyInactive && canRestore && (
                          <Button variant="secondary" onClick={restoreSelected}>
                            <RotateCcw className="w-4 h-4 mr-1" /> Restaurer ({selectedIds.length})
                          </Button>
                        )}
                        {anyActive && canDelete && (
                          <Button variant="destructive" onClick={deleteSelected}>
                            <Trash2 className="w-4 h-4 mr-1" /> Supprimer ({selectedIds.length})
                          </Button>
                        )}
                      </>
                    )}
                  </div>

                  {showFilterPanel && (
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 w-full lg:max-w-2xl relative z-[60]">
                      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4" /> Filtrer les produits
                      </h3>

                      {/* Sélection du type de filtre */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <select
                          value={currentFilterField}
                          onChange={(e) => {
                            setCurrentFilterField(e.target.value as ProductFilterType['field']);
                            setCurrentFilterValue(''); setCurrentFilterValue2(''); setCurrentFilterOperator('contains');
                          }}
                          className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                        >
                          <option value="search">Recherche globale</option>
                          <option value="name">Nom</option>
                          <option value="category">Catégorie</option>
                          <option value="price">Prix</option>
                          <option value="stock">Stock</option>
                          <option value="status">Statut</option>
                          <option value="date">Date de création</option>
                        </select>

                        {(currentFilterField === 'price' || currentFilterField === 'stock') && (
                          <select
                            value={currentFilterOperator}
                            onChange={(e) => setCurrentFilterOperator(e.target.value as ProductFilterType['operator'])}
                            className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                          >
                            <option value="equals">Égal à</option>
                            <option value="gt">Supérieur à</option>
                            <option value="gte">Supérieur ou égal à</option>
                            <option value="lt">Inférieur à</option>
                            <option value="lte">Inférieur ou égal à</option>
                            <option value="between">Entre</option>
                          </select>
                        )}
                      </div>

                      {/* Saisie des valeurs */}
                      <div className="mb-3">
                        {currentFilterField === 'date' ? (
                          <div className="flex flex-wrap items-center gap-3 relative z-[70]">
                            <div className="flex-1 min-w-[180px]">
                              <ModernDatePicker
                                selected={startDate}
                                onChange={(date) => setStartDate(date)}
                                placeholder="Date de début"
                                selectsStart
                                startDate={startDate}
                                endDate={endDate}
                                className="w-full relative z-[80]"
                              />
                            </div>
                            <span className="text-slate-500 dark:text-slate-400 font-medium">à</span>
                            <div className="flex-1 min-w-[180px]">
                              <ModernDatePicker
                                selected={endDate}
                                onChange={(date) => setEndDate(date)}
                                placeholder="Date de fin"
                                selectsEnd
                                startDate={startDate}
                                endDate={endDate}
                                minDate={startDate || undefined}
                                className="w-full relative z-[80]"
                              />
                            </div>
                          </div>
                        ) : currentFilterField === 'status' ? (
                          <select
                            value={currentFilterValue}
                            onChange={(e) => setCurrentFilterValue(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                          >
                            <option value="">Sélectionner un statut</option>
                            <option value="actif">Actif</option>
                            <option value="désactivé">Désactivé</option>
                          </select>
                        ) : currentFilterOperator === 'between' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type={currentFilterField === 'price' || currentFilterField === 'stock' ? 'number' : 'text'}
                              step={currentFilterField === 'price' ? '0.01' : '1'}
                              min="0"
                              value={currentFilterValue}
                              onChange={(e) => setCurrentFilterValue(e.target.value)}
                              placeholder="Valeur minimale"
                              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                            />
                            <span className="text-slate-500 dark:text-slate-400">à</span>
                            <input
                              type={currentFilterField === 'price' || currentFilterField === 'stock' ? 'number' : 'text'}
                              step={currentFilterField === 'price' ? '0.01' : '1'}
                              min="0"
                              value={currentFilterValue2}
                              onChange={(e) => setCurrentFilterValue2(e.target.value)}
                              placeholder="Valeur maximale"
                              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                            />
                          </div>
                        ) : (
                          <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                              type={currentFilterField === 'price' || currentFilterField === 'stock' ? 'number' : 'text'}
                              step={currentFilterField === 'price' ? '0.01' : '1'}
                              min={currentFilterField === 'price' || currentFilterField === 'stock' ? 0 : undefined}
                              value={currentFilterValue}
                              onChange={(e) => setCurrentFilterValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && addFilter()}
                              placeholder={`Filtrer par ${
                                ({
                                  search: 'Recherche globale',
                                  name: 'Nom',
                                  category: 'Catégorie',
                                  price: 'Prix',
                                  stock: 'Stock',
                                  status: 'Statut',
                                  date: 'Date de création',
                                } as Record<string, string>)[currentFilterField]
                              }`.toLowerCase()}
                              className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                            />
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={addFilter}
                        disabled={
                          currentFilterField === 'date'
                            ? !startDate || !endDate
                            : currentFilterOperator === 'between'
                            ? !currentFilterValue || !currentFilterValue2
                            : !currentFilterValue
                        }
                        className="w-full"
                      >
                        Ajouter le filtre
                      </Button>
                    </div>
                  )}

                  {activeFilters.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {activeFilters.map((f, i) => (
                        <span
                          key={`${f.field}-${f.value}-${i}`}
                          className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200 px-3 py-1.5 rounded-lg text-sm"
                        >
                          <span className="font-medium">
                            {({
                              search: 'Recherche globale',
                              name: 'Nom',
                              category: 'Catégorie',
                              price: 'Prix',
                              stock: 'Stock',
                              status: 'Statut',
                              date: 'Date de création',
                            } as Record<string, string>)[f.field]}
                          </span>
                          <span className="text-xs opacity-75">
                            ({({
                              contains: 'Contient',
                              equals: 'Égal à',
                              gt: 'Supérieur à',
                              gte: 'Supérieur ou égal à',
                              lt: 'Inférieur à',
                              lte: 'Inférieur ou égal à',
                              between: 'Entre',
                              date_range: 'Intervalle',
                            } as Record<string, string>)[f.operator || 'contains']})
                          </span>
                          :{' '}
                          <span>
                            {f.operator === 'between' && f.value2
                              ? `${f.value} - ${f.value2}`
                              : f.operator === 'date_range' && f.value2
                              ? `${parseDateFromYMD(f.value).toLocaleDateString('fr-FR')} - ${parseDateFromYMD(f.value2).toLocaleDateString('fr-FR')}`
                              : f.value}
                          </span>
                          <button onClick={() => removeFilter(i)}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Droite : per-page + créer */}
                <div className="flex items-center gap-3 ml-auto">
                  <div className="relative min-w-[220px]">
                    <select
                      value={products.per_page}
                      onChange={(e) => changePer(Number(e.target.value))}
                      className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-4 pr-10 py-2.5 text-sm text-slate-600 dark:text-slate-100"
                    >
                      {[5, 10, 20, 50].map((n) => (
                        <option key={n} value={n}>{n} lignes par page</option>
                      ))}
                      <option value={-1}>Tous</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>

                  {canCreate && (
                    <Link href={route('products.create')}>
                      <Button className="bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-600 shadow-md">
                        <Plus className="w-4 h-4 mr-1" /> Ajouter un produit
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl overflow-hidden relative z-10">
              <table className="min-w-full text-sm divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-xs">
                  <tr>
                    {showSelectCol && (
                      <th className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={products.data.length > 0 && selectedIds.length === products.data.length}
                          onChange={() => toggleSelectAll()}
                          className="rounded border-slate-300 text-red-600"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 cursor-pointer" onClick={() => changeSort('name')}>
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        Nom {sort === 'name' && (dir === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>
                    <th className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        Catégorie
                      </div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer" onClick={() => changeSort('price')}>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Prix {sort === 'price' && (dir === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center cursor-pointer" onClick={() => changeSort('stock_quantity')}>
                      <div className="flex items-center justify-center gap-2">
                        <Archive className="w-4 h-4" />
                        Stock {sort === 'stock_quantity' && (dir === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Statut
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center cursor-pointer" onClick={() => changeSort('created_at')}>
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" />
                        Créé {sort === 'created_at' && (dir === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>
                    {showActionsCol && (
                      <th className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <MoreHorizontal className="w-4 h-4" />
                          Actions
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {products.data.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6 + (showSelectCol ? 1 : 0) + (showActionsCol ? 1 : 0)}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        Aucun produit trouvé.
                      </td>
                    </tr>
                  ) : (
                    products.data.map((p) => {
                      const rowCanRestore = !!p.deleted_at && canRestore;
                      const rowCanDelete  = !p.deleted_at && canDelete;
                      const rowCanShow    = canShow;
                      const rowCanEdit    = canEdit;

                      return (
                        <tr
                          key={p.id}
                          className={`${p.deleted_at ? 'bg-red-50 dark:bg-red-900/10' : ''} hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors`}
                        >
                          {showSelectCol && (
                            <td className="px-4 py-3 text-center">
                              {(p.deleted_at ? canRestore : canDelete) ? (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(p.id)}
                                  onChange={() => toggleSelect(p.id)}
                                  className="rounded border-slate-300 text-red-600"
                                />
                              ) : (
                                <input type="checkbox" disabled className="rounded border-slate-300 text-slate-300" />
                              )}
                            </td>
                          )}

                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.name}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-300">{p.category?.name}</td>
                          <td className="px-4 py-3">{p.price} {p.currency?.symbol}</td>
                          <td className="px-4 py-3 text-center">{p.stock_quantity}</td>
                          <td className="px-4 py-3 text-center">
                            {p.deleted_at ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                Désactivé
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Actif
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </td>

                          {showActionsCol && (
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center gap-2">
                                {p.deleted_at ? (
                                  rowCanRestore && (
                                    <button
                                      onClick={() => router.post(route('products.restore', { id: p.id }))}
                                      className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                                      aria-label="Restaurer"
                                    >
                                      <RotateCcw className="w-5 h-5" />
                                    </button>
                                  )
                                ) : (
                                  <>
                                    {rowCanShow && (
                                      <Link
                                        href={route('products.show', p.id)}
                                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-800/30"
                                        aria-label="Voir"
                                      >
                                        <Eye className="w-5 h-5" />
                                      </Link>
                                    )}
                                    {rowCanEdit && (
                                      <Link
                                        href={route('products.edit', p.id)}
                                        className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 p-1 rounded-full hover:bg-yellow-50 dark:hover:bg-yellow-800/30"
                                        aria-label="Éditer"
                                      >
                                        <Pencil className="w-5 h-5" />
                                      </Link>
                                    )}
                                    {rowCanDelete && (
                                      <button
                                        onClick={() => router.delete(route('products.destroy', { id: p.id }))}
                                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-800/30"
                                        aria-label="Supprimer"
                                      >
                                        <Trash2 className="w-5 h-5" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl mt-4 text-sm text-slate-700 dark:text-slate-200">
              <span>Affichage de {products.from} à {products.to} sur {products.total} résultats</span>

              {products.last_page > 1 && (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" disabled={products.current_page === 1} onClick={() => changePage(1)} aria-label="Première page">
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" disabled={products.current_page === 1} onClick={() => changePage(products.current_page - 1)} aria-label="Page précédente">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  {windowPages.map((p, idx) =>
                    p === '…' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 select-none">…</span>
                    ) : (
                      <Button key={`page-${p}`} size="sm" variant={p === products.current_page ? 'default' : 'outline'} onClick={() => changePage(p as number)}>
                        {p}
                      </Button>
                    ),
                  )}

                  <Button size="sm" variant="outline" disabled={products.current_page === products.last_page} onClick={() => changePage(products.current_page + 1)} aria-label="Page suivante">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" disabled={products.current_page === products.last_page} onClick={() => changePage(products.last_page)} aria-label="Dernière page">
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    </>
  );
}
