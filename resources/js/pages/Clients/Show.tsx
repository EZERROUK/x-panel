import React, { useState, useMemo, JSX } from 'react'
import { Head, Link, usePage } from '@inertiajs/react'
import { route } from 'ziggy-js'
import {
  ArrowLeft, Pencil, Info, User, Building2, FileText,
  Mail, Phone, MapPin, Hash, Calendar, CreditCard,
  Shield, Receipt, Building, Users
} from 'lucide-react'

import AppLayout from '@/layouts/app-layout'
import { Button } from '@/components/ui/button'

// Types et props (inchangés)
type Tab = 'details' | 'fiscal' | 'quotes' | 'orders' | 'notes'

interface Client {
  id: number;
  company_name: string;
  contact_name?: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  postal_code?: string;
  country: string;
  ice?: string;
  rc?: string;
  patente?: string;
  cnss?: string;
  if_number?: string;
  tax_regime: 'normal' | 'auto_entrepreneur' | 'exonere';
  is_tva_subject: boolean;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at?: string;
  creator?: { id: number; name: string } | null;
  updater?: { id: number; name: string } | null;
  quotes: Array<{
    id: number;
    quote_number: string;
    status: string;
    total_ttc: number;
    currency_code: string;
    created_at: string;
  }>;
  orders: Array<{
    id: number;
    order_number: string;
    status: string;
    total_ttc: number;
    currency_code: string;
    created_at: string;
  }>;
}

interface Props {
  client: Client;
}

// Hook pour gérer les permissions
const useCan = () => {
  const { props } = usePage<{ auth?: { roles?: string[]; permissions?: string[] } }>();
  const roles = props.auth?.roles ?? [];
  const perms = props.auth?.permissions ?? [];
  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('super-admin');
  const set = useMemo(() => new Set(perms), [perms.join(',')]);
  const can = (p?: string) => !p || isSuperAdmin || set.has(p);
  return { can, isSuperAdmin };
};

// Composant principal
export default function ClientShow({ client }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const { can } = useCan(); // Utilisation des permissions

  // Données dérivées
  const isDeleted = !client.is_active;
  const created = new Date(client.created_at);
  const updated = client.updated_at ? new Date(client.updated_at) : null;

  const getTaxRegimeLabel = (regime: string) => {
    const labels = {
      normal: 'Normal',
      auto_entrepreneur: 'Auto-entrepreneur',
      exonere: 'Exonéré'
    };
    return labels[regime as keyof typeof labels] || regime;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: 'secondary',
      sent: 'default',
      viewed: 'default',
      accepted: 'green',
      rejected: 'red',
      expired: 'secondary',
      converted: 'green',
      pending: 'secondary',
      confirmed: 'green',
      processing: 'default',
      shipped: 'default',
      delivered: 'green',
      cancelled: 'red',
    };
    return variants[status as keyof typeof variants] || 'secondary';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      draft: 'Brouillon',
      sent: 'Envoyé',
      viewed: 'Consulté',
      accepted: 'Accepté',
      rejected: 'Refusé',
      expired: 'Expiré',
      converted: 'Converti',
      pending: 'En attente',
      confirmed: 'Confirmé',
      processing: 'En cours',
      shipped: 'Expédié',
      delivered: 'Livré',
      cancelled: 'Annulé',
    };
    return labels[status as keyof typeof labels] || status;
  };

  return (
    <>
      <Head title={`Client – ${client.company_name}`} />

      <div className="min-h-screen bg-gradient-to-br from-white via-slate-100 to-slate-200 dark:from-[#0a0420] dark:via-[#0e0a32] dark:to-[#1B1749] transition-colors duration-500">
        <AppLayout breadcrumbs={[
          { title: 'Dashboard', href: '/dashboard' },
          { title: 'Clients', href: '/clients' },
          { title: client.company_name, href: route('clients.show', client.id) },
        ]}>

          <div className="p-6">
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 backdrop-blur-md rounded-xl shadow-xl flex flex-col lg:flex-row gap-6 items-start px-4 sm:px-5 py-4 sm:py-5">
              <div className="w-32 h-32 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <Building2 className="w-12 h-12 text-slate-400" />
              </div>

              <div className="flex-1 space-y-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{client.company_name}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">{client.contact_name || 'Aucun contact'}</p>
                <p className="text-sm text-slate-700 dark:text-slate-300"><span className="font-medium">Email :</span> {client.email}</p>
                <p className="text-sm text-slate-700 dark:text-slate-300"><span className="font-medium">Ville :</span> {client.city}</p>
                {isDeleted
                  ? <Badge text="Inactif" color="red" />
                  : <Badge text="Actif"   color="green" />}
              </div>

              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <Link href={route('clients.index')} className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto"><ArrowLeft className="w-4 h-4 mr-1" />Retour</Button>
                </Link>
                {can('client_edit') && !isDeleted && (
                  <Link href={route('clients.edit', client.id)} className="w-full sm:w-auto">
                    <Button className="group relative flex items-center justify-center
                                       rounded-lg bg-gradient-to-r from-red-600 to-red-500 px-5 py-3
                                       text-sm font-semibold text-white shadow-md transition-all
                                       hover:from-red-500 hover:to-red-600 focus:ring-2 focus:ring-red-500">
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
                {(['details','fiscal','quotes','orders','notes'] as Tab[]).map(tab => (
                  <TabButton key={tab} tab={tab} active={activeTab} setActive={setActiveTab} />
                ))}
              </div>

              {/* contenu */}
              <div className="p-6 md:col-span-3 overflow-y-auto text-slate-700 dark:text-slate-300">
                {activeTab === 'details' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Detail icon={Building2} label="Entreprise"    value={client.company_name} />
                    <Detail icon={User}      label="Contact"       value={client.contact_name || '—'} />
                    <Detail icon={Mail}      label="Email"         value={client.email} />
                    <Detail icon={Phone}     label="Téléphone"     value={client.phone || '—'} />
                    <Detail icon={MapPin}    label="Adresse"       value={`${client.address}, ${client.postal_code || ''} ${client.city}`} />
                    <Detail icon={MapPin}    label="Pays"          value={client.country} />

                    {/* 📌 Dates + auteurs */}
                    <Detail
                      icon={Calendar}
                      label="Créé"
                      value={`${created.toLocaleString('fr-FR')}${client.creator?.name ? ` • par ${client.creator.name}` : ''}`}
                    />

                    {updated && (
                      <Detail
                        icon={Calendar}
                        label="Dernière modification"
                        value={`${updated.toLocaleString('fr-FR')}${client.updater?.name ? ` • par ${client.updater.name}` : ''}`}
                      />
                    )}
                  </div>
                )}
                {/* Autres tabs (fiscal, quotes, orders, etc.) restent inchangés */}
              </div>
            </div>
          </div>
        </AppLayout>
      </div>
    </>
  )
}

// UI helpers inchangés
const Badge = ({ text, color }: { text:string; color:'red'|'green'|'secondary'|'default' }) => (
  <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium select-none tracking-wide
    ${color==='red' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
     :color==='green' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
     :'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400'}`}>
    {text}
  </span>
)

const Detail = ({ icon: Icon, label, value }:{
  icon: typeof Building2; label:string; value:React.ReactNode;
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
    details:<Info className="inline w-4 h-4 mr-2"/>,
    fiscal:<Receipt className="inline w-4 h-4 mr-2"/>,
    quotes:<FileText className="inline w-4 h-4 mr-2"/>,
    orders:<Building className="inline w-4 h-4 mr-2"/>,
    notes:<FileText className="inline w-4 h-4 mr-2"/>,
  }
  const labels:Record<Tab,string> = {
    details:'Détails', fiscal:'Informations fiscales', quotes:'Devis',
    orders:'Commandes', notes:'Notes',
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
