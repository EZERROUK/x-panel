import { useEffect, useMemo, useState } from 'react'
import { Link, usePage } from '@inertiajs/react'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar'
import { NavUser } from '@/components/nav-user'
import { type SharedData, type AppSettings } from '@/types'
import {
  Home, Users, User, UserCog, Key, History, ClipboardList, LogIn,
  Boxes, Layers, Package, Building2, FileSignature, Receipt,
  Warehouse, Repeat, LineChart, Percent, Wallet, CircleDollarSign, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppearance } from '@/hooks/use-appearance'

type Props = SharedData & {
  settings: AppSettings
  auth?: { roles?: unknown; permissions?: unknown }
}

type NavItem = {
  title: string
  href?: string
  icon?: React.ComponentType<{ className?: string }>
  required?: string
  children?: NavItem[]
}

// Helpers
const toArray = (v: unknown): string[] => {
  if (!v) return []
  if (Array.isArray(v)) return v.map(x => String(x))
  return Object.values(v as Record<string, unknown>).map(x => String(x))
}

const elementsNavigation: NavItem[] = [
  { title: 'Tableau de bord', href: '/dashboard', icon: Home },

  {
    title: 'Gestion des utilisateurs',
    icon: Users,
    children: [
      { title: 'Utilisateurs', href: '/users', icon: User,     required: 'user_list' },
      { title: 'Rôles',       href: '/roles', icon: UserCog,   required: 'role_list' },
      { title: 'Permissions', href: '/permissions', icon: Key, required: 'permission_list' },
    ],
  },

  {
    title: 'Historique des journaux',
    icon: History,
    children: [
      { title: "Journaux d'audit", href: '/audit-logs', icon: ClipboardList, required: 'audit_list' },
      { title: 'Connexions',       href: '/login-logs', icon: LogIn,         required: 'loginlog_list' },
    ],
  },

  {
    title: 'Catalogue',
    icon: Boxes,
    children: [
      { title: 'Catégories', href: '/categories', icon: Layers,  required: 'category_list' },
      { title: 'Produits',   href: '/products',   icon: Package, required: 'product_list' },
    ],
  },

  {
    title: 'Gestion commerciale',
    icon: Building2,
    children: [
      { title: 'Clients',  href: '/clients',  icon: Users,        required: 'client_list' },
      { title: 'Promotions',  href: '/promotions', icon: Percent },
      { title: 'Devis',    href: '/quotes',   icon: FileSignature, required: 'quote_list' },
      { title: 'Factures', href: '/invoices', icon: Receipt,       required: 'invoice_list' },
    ],
  },

  {
    title: 'Gestion de stock',
    icon: Warehouse,
    children: [
      { title: 'Mouvements de stock', href: '/stock-movements',        icon: Repeat,    required: 'stock_movement_list' },
      { title: 'Rapport de stock',    href: '/stock-movements/report', icon: LineChart, required: 'stock_movement_list' },
    ],
  },

  {
    title: 'Paramètres financiers',
    icon: Wallet,
    children: [
      { title: 'TVA',     href: '/tax-rates',  icon: Percent,          required: 'taxrate_list' },
      { title: 'Devises', href: '/currencies', icon: CircleDollarSign, required: 'currency_list' },
    ],
  },
]

export function AppSidebar() {
  const { url, props: { settings, auth } } = usePage<Props>()
  const { isDark } = useAppearance()
  const { state: sidebarState } = useSidebar()
  const estRéduit = sidebarState === 'collapsed'
  const [menuOuvert, setMenuOuvert] = useState<string | null>(null)

  const roles = useMemo(() => toArray(auth?.roles), [auth?.roles])
  const permsSet = useMemo(() => new Set(toArray(auth?.permissions)), [auth?.permissions])
  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('super-admin')
  const can = (permission?: string) => !permission || isSuperAdmin || permsSet.has(permission)

  // 🔧 Filtrage: si parent n’a pas `required`, il doit avoir au moins 1 enfant visible
  const filteredNavigation = useMemo<NavItem[]>(() =>
    elementsNavigation
      .map(item => {
        if (item.children?.length) {
          const visibleChildren = item.children.filter(c => can(c.required))
          const showParent = item.required
            ? (can(item.required) || visibleChildren.length > 0)
            : (visibleChildren.length > 0) // <= clé: pas de required → nécessite enfants visibles
          return showParent ? { ...item, children: visibleChildren } : null
        }
        return can(item.required) ? item : null
      })
      .filter(Boolean) as NavItem[]
  , [permsSet, isSuperAdmin])

  useEffect(() => {
    filteredNavigation.forEach(item => {
      if (item.children && item.children.some(c => estActif(c.href))) {
        if (menuOuvert !== item.title) setMenuOuvert(item.title)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, filteredNavigation])

  const basculerMenu = (titre: string) =>
    setMenuOuvert(prev => (prev === titre ? null : titre))

  const estActif = (href?: string) => {
    if (!href) return false
    if (href === '/') return url === '/'
    if (url === href) return true
    const allHrefs = getAllHrefs(filteredNavigation)
    const urlStartsWithHref = url.startsWith(href + '/')
    const longerMatchingHrefs = allHrefs.filter(
      h => h !== href && h.startsWith(href + '/') && url.startsWith(h)
    )
    return urlStartsWithHref && longerMatchingHrefs.length === 0
  }

  const getAllHrefs = (items: NavItem[]): string[] => {
    const hrefs: string[] = []
    items.forEach(item => {
      if (item.href) hrefs.push(item.href)
      if (item.children) hrefs.push(...getAllHrefs(item.children))
    })
    return hrefs
  }

  const logoUrl = isDark ? settings.logo_dark_url || settings.logo_url : settings.logo_url

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard" className="flex justify-center py-4">
                <img
                  key={logoUrl}
                  src={logoUrl || '/logo.svg'}
                  alt={settings.app_name}
                  className="h-10 w-auto object-contain rounded"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="overflow-hidden text-sidebar-foreground">
        <nav className="space-y-1">
          {filteredNavigation.map(item =>
            item.children ? (
              <div key={item.title}>
                <button
                  onClick={() => basculerMenu(item.title)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    menuOuvert === item.title
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
                  )}
                >
                  <div className="flex items-center">
                    {item.icon && <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />}
                    {!estRéduit && <span className="truncate">{item.title}</span>}
                  </div>
                  {!estRéduit && (
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform', menuOuvert === item.title && 'rotate-180')}
                    />
                  )}
                </button>
                {!estRéduit && menuOuvert === item.title && item.children.length > 0 && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.children.map(child => (
                      <Link
                        key={child.title}
                        href={child.href!}
                        className={cn(
                          'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                          estActif(child.href)
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
                        )}
                      >
                        {child.icon && <child.icon className="mr-3 h-5 w-5 flex-shrink-0" />}
                        <span className="truncate">{child.title}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={item.title}
                href={item.href!}
                className={cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  estActif(item.href)
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
                )}
              >
                {item.icon && <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />}
                {!estRéduit && <span className="truncate">{item.title}</span>}
              </Link>
            )
          )}
        </nav>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
