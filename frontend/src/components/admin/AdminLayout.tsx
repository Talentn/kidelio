import { useEffect, useState, useCallback } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Boxes, ShoppingCart,
  Tags, Activity, Store, LogOut, MessageSquare, Menu, X, Ruler, Megaphone, Users, Ticket, Layout,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { apiAdmin } from '../../lib/api'
import { useLivePoll } from '../../hooks/useLivePoll'
import { ToastProvider } from './ui'

type Stats = { unread_messages: number; pending_orders: number }

function useAdminStats() {
  const [stats, setStats] = useState<Stats>({ unread_messages: 0, pending_orders: 0 })

  const refresh = useCallback(() => {
    apiAdmin<Stats>('/dashboard/stats').then(setStats).catch(() => {})
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useLivePoll(refresh, [refresh], { interval: 5_000 })

  return stats
}

function Badge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="ml-auto min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-bold px-1.5 leading-none">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function AdminLayout() {
  const navigate   = useNavigate()
  const { logout } = useAuth()
  const stats      = useAdminStats()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/connexion')
  }

  const NAV = [
    { to: '/admin',            label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    { to: '/admin/produits',   label: 'Produits',         icon: Package },
    { to: '/admin/stock',      label: 'Stock',            icon: Boxes },
    { to: '/admin/commandes',  label: 'Commandes',        icon: ShoppingCart,   badge: stats.pending_orders },
    { to: '/admin/categories', label: 'Catégories',       icon: Tags },
    { to: '/admin/accueil',    label: "Page d'accueil",   icon: Layout },
    { to: '/admin/messages',   label: 'Messages',         icon: MessageSquare,  badge: stats.unread_messages },
    { to: '/admin/promos',     label: 'Popups promo',     icon: Megaphone },
    { to: '/admin/codes-promo', label: 'Codes promo',     icon: Ticket },
    { to: '/admin/utilisateurs', label: 'Utilisateurs',   icon: Users },
    { to: '/admin/attributs',  label: 'Attributs',        icon: Ruler },
    { to: '/admin/activite',   label: 'Activité',         icon: Activity },
  ]

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src="/kidelio-heads-favicon.png" alt="Kidelio" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
          <div>
            <p className="font-display font-semibold text-white text-sm leading-none tracking-wide">Kidelio</p>
            <p className="text-slate-400 text-xs mt-1">Administration</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-white/8 hover:text-white'
              }`
            }
          >
            <Icon size={17} className="flex-shrink-0" />
            <span className="truncate">{label}</span>
            <Badge count={badge ?? 0} />
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        <NavLink
          to="/"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-white/8 hover:text-white transition-all"
        >
          <Store size={17} className="flex-shrink-0" />
          Voir la boutique
        </NavLink>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-all"
        >
          <LogOut size={17} className="flex-shrink-0" />
          Déconnexion
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-dvh bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 xl:w-64 bg-slate-900 flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 w-64 bg-slate-900 flex flex-col flex-shrink-0">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/kidelio-heads-favicon.png" alt="Kidelio" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
            <span className="font-display font-semibold text-slate-800 text-sm">Kidelio Admin</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              En direct
            </span>
          </div>
        </div>

        <main className="flex-1">
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </main>
      </div>
    </div>
  )
}
