import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { route } from 'ziggy-js';
import toast from 'react-hot-toast';

import AppLayout from '@/layouts/app-layout';
import ParticlesBackground from '@/components/ParticlesBackground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Plus,
  Search,
  Filter,
  FileText,
  Building2,
  User,
  Calendar,
  DollarSign,
  Package,
  CheckCircle,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2,
  Eye,
  Pencil,
  Clock,
  ChevronDown,
  Copy,
  ShoppingCart,
  Download,
  AlertTriangle,
  RotateCcw,
  X,
  SlidersHorizontal,
} from 'lucide-react';

import { Pagination, PageProps } from '@/types';

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */
interface Quote {
  id: number;
  quote_number: string;
  status: string;
  quote_date: string;
  valid_until: string;
  subtotal_ht: number;
  total_tax: number;
  total_ttc: number;
  currency: {
    code: string;
    symbol: string;
  };
  client: {
    id: number;
    company_name: string;
    contact_name?: string;
  };
  user: {
    name: string;
  };
  items_count: number;
  deleted_at?: string;
  created_at: string;
}

interface Client {
  id: number;
  company_name: string;
}

interface Flash {
  success?: string;
  error?: string;
}

interface Props extends PageProps<{
  quotes: Pagination<Quote>;
  clients: Client[];
  filters: {
    search?: string;
    status?: string;
    client_id?: string;
  };
  flash?: Flash;
}> {}

/* ------------------------------ Permissions ------------------------------ */
const useCan = () => {
  const { props } = usePage<{ auth?: { roles?: string[]; permissions?: string[] } }>();
  const roles = props.auth?.roles ?? [];
  const perms = props.auth?.permissions ?? [];
  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('super-admin');
  const set = useMemo(() => new Set(perms), [perms.join(',')]);
  const can = (p?: string) => !p || isSuperAdmin || set.has(p);
  return { can, isSuperAdmin };
};

/* -------------------------------------------------------------------------- */
/*                                COMPONENT                                   */
/* -------------------------------------------------------------------------- */
export default function QuotesIndex({ quotes: raw, clients, filters, flash }: Props) {
  const { can } = useCan();

  /* ----------------------- Pagination safe destructuring ---------------------- */
  const {
    data: rows = [],
    current_page = 1,
    last_page = 1,
    from = 0,
    to = 0,
    total = 0,
    per_page = 15,
  } = raw ?? { data: [] };

  /* ------------------------------ UI STATE ----------------------------------- */
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchVal, setSearchVal] = useState(filters.search ?? '');
  const [statusVal, setStatusVal] = useState(filters.status ?? '');
  const [clientIdVal, setClientIdVal] = useState(filters.client_id ?? '');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showSuccess, setShowSuccess] = useState(!!flash?.success);
  const [showError, setShowError] = useState(!!flash?.error);

  /* ------------------------------ FLASH --------------------------------- */
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

  /* ------------------------------ Helpers ------------------------------------ */
  const go = (extra: Record<string, any> = {}) =>
    router.get(
      route('quotes.index'),
      {
        search: searchVal || undefined,
        status: statusVal || undefined,
        client_id: clientIdVal || undefined,
        per_page: per_page,
        ...extra,
      },
      { preserveScroll: true, preserveState: true },
    );

  const changePage = (p: number) => go({ page: p });
  const changePer = (n: number) => go({ page: 1, per_page: n });

  const resetFilters = () => {
    setSearchVal('');
    setStatusVal('');
    setClientIdVal('');
    router.get(
      route('quotes.index'),
      { page: 1, per_page: per_page || 15 },
      { preserveScroll: true, preserveState: true },
    );
  };

  const windowPages = useMemo<(number | '…')[]>(() => {
    const pages: (number | '…')[] = [];
    const MAX = 5;
    const c = current_page;
    const l = last_page;

    if (l <= MAX + 2) {
      for (let i = 1; i <= l; i++) pages.push(i);
      return pages;
    }

    pages.push(1);
    let start = Math.max(2, c - Math.floor(MAX / 2));
    let end = start + MAX - 1;

    if (end >= l) {
      end = l - 1;
      start = end - MAX + 1;
    }

    if (start > 2) pages.push('…');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < l - 1) pages.push('…');
    pages.push(l);

    return pages;
  }, [current_page, last_page]);

  /* ------------------------------- CRUD -------------------------------- */
  const restoreOne = (id: number) => {
    if (!can('quote_restore')) return alert("Permission manquante: quote_restore");
    if (confirm('Restaurer ce devis ?'))
      router.post(route('quotes.restore', { id }), {}, { preserveScroll: true });
  };

  const deleteOne = (quote: Quote) => {
    if (!can('quote_delete')) return alert("Permission manquante: quote_delete");
    if (confirm(`Êtes-vous sûr de vouloir supprimer le devis « ${quote.quote_number} » ?`)) {
      router.delete(route('quotes.destroy', quote.id), {
        preserveScroll: true,
        onSuccess: () => toast.success('Devis supprimé avec succès'),
        onError: () => toast.error('Erreur lors de la suppression'),
      });
    }
  };

  const duplicateOne = (quote: Quote) => {
    if (!can('quote_create')) return alert("Permission manquante: quote_create");
    router.post(
      route('quotes.duplicate', quote.id),
      {},
      {
        preserveScroll: true,
        onSuccess: () => toast.success('Devis dupliqué avec succès'),
        onError: () => toast.error('Erreur lors de la duplication'),
      },
    );
  };

  const deleteSelected = () => {
    if (!can('quote_delete')) return alert("Permission manquante: quote_delete");
    if (!selectedIds.length) return;
    if (!confirm(`Supprimer ${selectedIds.length} devis ?`)) return;
    Promise.all(
      selectedIds.map((id) =>
        router.delete(route('quotes.destroy', { id }), { preserveScroll: true }),
      ),
    ).then(() => setSelectedIds([]));
  };

  const restoreSelected = () => {
    if (!can('quote_restore')) return alert("Permission manquante: quote_restore");
    if (!selectedIds.length) return;
    if (!confirm(`Restaurer ${selectedIds.length} devis ?`)) return;
    Promise.all(
      selectedIds.map((id) =>
        router.post(route('quotes.restore', { id }), {}, { preserveScroll: true }),
      ),
    ).then(() => setSelectedIds([]));
  };

  /* ------------------------ SELECTION HELPERS ------------------------ */
  const toggleSelect = (id: number) => {
    const quote = rows.find(q => q.id === id);
    const isActive = !quote?.deleted_at;

    // on autorise la sélection seulement si l'action correspondante est permise
    if (isActive && !can('quote_delete')) return;
    if (!isActive && !can('quote_restore')) return;

    setSelectedIds((p) => (p.includes(id) ? p.filter((i) => i !== id) : [...p, id]));
  };

  const toggleSelectAll = () => {
    if (!rows.length) return;
    const first = rows[0];
    const firstActive = !first.deleted_at;

    const canBulkDelete = can('quote_delete');
    const canBulkRestore = can('quote_restore');

    if (selectedIds.length === rows.length) {
      setSelectedIds([]);
    } else {
      const ids = rows
        .filter(quote => {
          const active = !quote.deleted_at;
          if (active && !canBulkDelete) return false;
          if (!active && !canBulkRestore) return false;
          return active === firstActive;
        })
        .map(q => q.id);
      setSelectedIds(ids);
    }
  };

  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const anyInactive = selectedIds.some((id) => !!rows.find((q) => q.id === id)?.deleted_at);
  const anyActive = selectedIds.some((id) => !rows.find((q) => q.id === id)?.deleted_at);

  /* -------------------------- UI Permissions -------------------------- */
  const canCreate = can('quote_create');
  const canBulkDelete = can('quote_delete');
  const canBulkRestore = can('quote_restore');

  // Montrer la colonne "Actions" seulement si au moins une action est possible
  const showActionsColumn = useMemo(() => {
    if (rows.length === 0) return false;
    return rows.some(quote => {
      const isActive = !quote.deleted_at;
      const canShow = can('quote_show');
      const canEdit = can('quote_edit');
      const canDel = can('quote_delete') && isActive;
      const canRes = can('quote_restore') && !isActive;
      const canDup = can('quote_create');
      const canExport = can('quote_show'); // export = besoin de voir
      return canShow || canEdit || canDel || canRes || canDup || canExport;
    });
  }, [rows, can]);

  // Header checkbox visible seulement si une action bulk est permise sur au moins un élément
  const showCheckboxHeader = useMemo(() => {
    return rows.some(quote => {
      const isActive = !quote.deleted_at;
      if (isActive && canBulkDelete) return true;
      if (!isActive && canBulkRestore) return true;
      return false;
    });
  }, [rows, canBulkDelete, canBulkRestore]);

  /* ------------------------ Utility functions --------------------------- */
  const getStatusBadge = (status: string) => {
    const variants = {
      draft: { label: 'Brouillon', class: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' },
      sent: { label: 'Envoyé', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      viewed: { label: 'Consulté', class: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
      accepted: { label: 'Accepté', class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      rejected: { label: 'Refusé', class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
      expired: { label: 'Expiré', class: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
      converted: { label: 'Converti', class: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
    };
    return variants[status as keyof typeof variants] || { label: status, class: 'bg-gray-100 text-gray-800' };
  };

  const isExpired = (quote: Quote) => {
    return new Date(quote.valid_until) < new Date() && ['sent', 'viewed'].includes(quote.status);
  };

  const formatCurrency = (amount: number, currency: { symbol: string }) => {
    return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency.symbol}`;
  };

  /* -------------------------------------------------------------------- */
  /*                                 RENDER                               */
  /* -------------------------------------------------------------------- */
  return (
    <>
      <Head title="Devis" />

      <AppLayout
        breadcrumbs={[
          { title: 'Dashboard', href: '/dashboard' },
          { title: 'Devis', href: '/quotes' },
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
                  Gestion des devis
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Gérez vos devis et propositions commerciales
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

                    {(searchVal || statusVal || clientIdVal) && (
                      <Button variant="outline" onClick={resetFilters} className="gap-1.5">
                        <X className="w-4 h-4" /> Effacer filtres
                      </Button>
                    )}

                    {selectedIds.length > 0 && (
                      <>
                        {anyInactive && canBulkRestore && (
                          <Button variant="secondary" onClick={restoreSelected}>
                            <RotateCcw className="w-4 h-4 mr-1" /> Restaurer ({selectedIds.length})
                          </Button>
                        )}
                        {anyActive && canBulkDelete && (
                          <Button variant="destructive" onClick={deleteSelected}>
                            <Trash2 className="w-4 h-4 mr-1" /> Supprimer ({selectedIds.length})
                          </Button>
                        )}
                      </>
                    )}
                  </div>

                  {showFilterPanel && (
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 w-full lg:max-w-3xl relative z-[60]">
                      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4" /> Filtrer les devis
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        {/* Recherche */}
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input
                            className="pl-9"
                            placeholder="Rechercher par numéro, client..."
                            value={searchVal}
                            onChange={(e) => setSearchVal(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && go({ page: 1 })}
                          />
                        </div>

                        {/* Statut */}
                        <Select value={statusVal} onValueChange={setStatusVal}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Statut" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Tous</SelectItem>
                            <SelectItem value="draft">Brouillon</SelectItem>
                            <SelectItem value="sent">Envoyé</SelectItem>
                            <SelectItem value="viewed">Consulté</SelectItem>
                            <SelectItem value="accepted">Accepté</SelectItem>
                            <SelectItem value="rejected">Refusé</SelectItem>
                            <SelectItem value="expired">Expiré</SelectItem>
                            <SelectItem value="converted">Converti</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Client */}
                        <Select value={clientIdVal} onValueChange={setClientIdVal}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Client" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Tous les clients</SelectItem>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id.toString()}>
                                {client.company_name}
                              </SelectItem>
                            ))}
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
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>

                  {canCreate && (
                    <Link href={route('quotes.create')}>
                      <Button className="bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-600 shadow-md">
                        <Plus className="w-4 h-4 mr-1" />
                        Nouveau devis
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
                    {showCheckboxHeader && (
                      <th className="w-[50px] px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!allSelected}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300 text-red-600"
                        />
                      </th>
                    )}
                    <th className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        Numéro
                      </div>
                    </th>
                    <th className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        Client
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Statut
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Date / Validité
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        Montant TTC
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Package className="w-4 h-4" />
                        Articles
                      </div>
                    </th>
                    {showActionsColumn && (
                      <th className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <MoreHorizontal className="w-4 h-4" />
                          Actions
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={showActionsColumn ? 8 : 7}
                        className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                          <div>
                            <p className="font-medium">Aucun devis trouvé</p>
                            <p className="text-xs">Aucun devis ne correspond aux critères de recherche</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((quote) => {
                      const isActive = !quote.deleted_at;
                      const canShow = can('quote_show');
                      const canEdit = can('quote_edit');
                      const canDel = can('quote_delete') && isActive;
                      const canRes = can('quote_restore') && !isActive;
                      const canDup = can('quote_create');
                      const canExport = can('quote_show');

                      const canSelectRow = (isActive && can('quote_delete')) || (!isActive && can('quote_restore'));
                      const showRowActions = canShow || canEdit || canDel || canRes || canDup || canExport;

                      return (
                        <tr
                          key={quote.id}
                          className={`${
                            quote.deleted_at ? 'bg-red-50 dark:bg-red-900/10' : ''
                          } hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors`}
                        >
                          {showCheckboxHeader && (
                            <td className="text-center px-3 py-4">
                              {canSelectRow ? (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(quote.id)}
                                  onChange={() => toggleSelect(quote.id)}
                                  className="rounded border-slate-300 text-red-600"
                                />
                              ) : <span className="inline-block w-4" />}
                            </td>
                          )}

                          {/* Numéro */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-slate-400" />
                              <div>
                                <div className="font-medium text-slate-900 dark:text-white">
                                  {quote.quote_number}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  Par {quote.user.name}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Client */}
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white">
                                {quote.client.company_name}
                              </div>
                              {quote.client.contact_name && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {quote.client.contact_name}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Statut */}
                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(quote.status).class}`}>
                                {getStatusBadge(quote.status).label}
                              </span>
                              {isExpired(quote) && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Expiré
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Date / Validité */}
                          <td className="px-6 py-4 text-center">
                            <div className="text-xs">
                              <div className="font-medium">
                                {new Date(quote.quote_date).toLocaleDateString('fr-FR')}
                              </div>
                              <div className={`${isExpired(quote) ? 'text-red-600 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                                Valide jusqu'au {new Date(quote.valid_until).toLocaleDateString('fr-FR')}
                              </div>
                            </div>
                          </td>

                          {/* Montant */}
                          <td className="px-6 py-4 text-center">
                            <div className="font-medium text-slate-900 dark:text-white">
                              {formatCurrency(quote.total_ttc, quote.currency)}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              HT: {formatCurrency(quote.subtotal_ht, quote.currency)}
                            </div>
                          </td>

                          {/* Articles */}
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                              {quote.items_count} article{quote.items_count > 1 ? 's' : ''}
                            </span>
                          </td>

                          {/* Actions */}
                          {showActionsColumn && (
                            <td className="px-6 py-4 text-center">
                              {showRowActions ? (
                                <div className="flex justify-center gap-2">
                                  {quote.deleted_at ? (
                                    canRes && (
                                      <button
                                        onClick={() => restoreOne(quote.id)}
                                        className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                                        aria-label="Restaurer"
                                      >
                                        <RotateCcw className="w-5 h-5" />
                                      </button>
                                    )
                                  ) : (
                                    <>
                                      {canShow && (
                                        <Link
                                          href={route('quotes.show', quote.id)}
                                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-800/30"
                                          aria-label="Voir"
                                        >
                                          <Eye className="w-5 h-5" />
                                        </Link>
                                      )}

                                      {canEdit && quote.status === 'draft' && (
                                        <Link
                                          href={route('quotes.edit', quote.id)}
                                          className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 p-1 rounded-full hover:bg-yellow-50 dark:hover:bg-yellow-800/30"
                                          aria-label="Modifier"
                                        >
                                          <Pencil className="w-5 h-5" />
                                        </Link>
                                      )}

                                      {canDup && (
                                        <button
                                          onClick={() => duplicateOne(quote)}
                                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 p-1 rounded-full hover:bg-green-50 dark:hover:bg-green-800/30"
                                          aria-label="Dupliquer"
                                        >
                                          <Copy className="w-5 h-5" />
                                        </button>
                                      )}

                                      {canExport && (
                                        <a
                                          href={route('quotes.export', quote.id)}
                                          className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 p-1 rounded-full hover:bg-purple-50 dark:hover:bg-purple-800/30"
                                          aria-label="Télécharger PDF"
                                        >
                                          <Download className="w-5 h-5" />
                                        </a>
                                      )}

                                      {canDel && ['draft', 'rejected'].includes(quote.status) && (
                                        <button
                                          onClick={() => deleteOne(quote)}
                                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-800/30"
                                          aria-label="Supprimer"
                                        >
                                          <Trash2 className="w-5 h-5" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-600 text-xs italic">
                                  Aucune action
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ------------------------------ Pagination ------------------------------ */}
            <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl mt-4 text-sm text-slate-700 dark:text-slate-200">
              <span>
                Affichage de {from} à {to} sur {total} devis
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
          </div>
        </div>
      </AppLayout>
    </>
  );
}
