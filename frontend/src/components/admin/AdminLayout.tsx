import { useEffect, useState, useCallback, useRef } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Boxes, ShoppingCart,
  Tags, Activity, Store, LogOut, MessageSquare, Menu, X, Ruler, Megaphone, Users, Ticket, Layout, Circle, MessageCircle, Archive, BarChart3, Server, ListTodo, Star,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { isSuperOps } from '../../lib/superOps'
import { apiAdmin } from '../../lib/api'
import { goGet } from '../../lib/goApi'
import { useLivePoll } from '../../hooks/useLivePoll'
import { ToastProvider } from './ui'

type Stats = { unread_messages: number; pending_orders: number }

function useAdminStats() {
  const [stats, setStats] = useState<Stats>({ unread_messages: 0, pending_orders: 0 })

  const refresh = useCallback(() => {
    apiAdmin<Stats>('/dashboard/stats').then(setStats).catch(() => {})
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useLivePoll(refresh, [refresh], { interval: import.meta.env.PROD ? 15_000 : 5_000 })

  return stats
}

type QueueRoom = { id: string }

// Short chime via Web Audio — no audio asset needed.
function playChatChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1175, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45)
    osc.start()
    osc.stop(ctx.currentTime + 0.47)
    osc.onended = () => ctx.close()
  } catch { /* audio not available */ }
}

function notifyNewChat(waiting: number) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    new Notification('Nouveau chat en attente', {
      body: waiting > 1 ? `${waiting} conversations en attente` : 'Un client attend une réponse',
      icon: '/kidelio-heads-favicon.png',
      tag: 'kidelio-chat',
    })
  } catch { /* notifications not available */ }
}

// Polls the live-chat queue and alerts (badge + sound + notification) on new chats.
function useChatAlerts() {
  const [waiting, setWaiting] = useState(0)
  const prev = useRef<number | null>(null)

  const refresh = useCallback(() => {
    goGet<{ queued: QueueRoom[]; active: QueueRoom[] }>('/chat/admin/queue')
      .then((d) => setWaiting((d.queued || []).length))
      .catch(() => {})
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useLivePoll(refresh, [refresh], { interval: import.meta.env.PROD ? 10_000 : 4_000 })

  // Ask for browser notification permission once.
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // Alert only when the waiting count increases (a new chat arrived).
  useEffect(() => {
    const before = prev.current
    if (before !== null && waiting > before) {
      playChatChime()
      notifyNewChat(waiting)
    }
    prev.current = waiting
  }, [waiting])

  return waiting
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
  const { user, logout, isAdmin } = useAuth()
  const stats      = useAdminStats()
  const chatWaiting = useChatAlerts()
  const [mobileOpen, setMobileOpen] = useState(false)
  const superOps   = isSuperOps(user?.email)

  const handleLogout = async () => {
    await logout()
    navigate('/connexion')
  }

  const NAV = [
    { to: '/admin',            label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    { to: '/admin/statistiques', label: 'Statistiques',   icon: BarChart3 },
    { to: '/admin/produits',   label: 'Produits',         icon: Package },
    { to: '/admin/stock',      label: 'Stock',            icon: Boxes },
    { to: '/admin/commandes',  label: 'Commandes',        icon: ShoppingCart,   badge: stats.pending_orders },
    { to: '/admin/avis',        label: 'Avis clients',     icon: Star },
    { to: '/admin/categories', label: 'Catégories',       icon: Tags },
    { to: '/admin/accueil',    label: "Page d'accueil",   icon: Layout },
    { to: '/admin/messages',   label: 'Messages',         icon: MessageSquare,  badge: stats.unread_messages },
    { to: '/admin/promos',     label: 'Popups promo',     icon: Megaphone },
    { to: '/admin/codes-promo', label: 'Codes promo',     icon: Ticket },
    ...(isAdmin ? [{ to: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users }] : []),
    { to: '/admin/attributs',  label: 'Attributs',        icon: Ruler },
    { to: '/admin/activite',   label: 'Activité',         icon: Activity },
    { to: '/admin/chat',          label: 'Chat Support',     icon: MessageCircle,  badge: chatWaiting },
    { to: '/admin/chat-archives', label: 'Archives chat',    icon: Archive },
    { to: '/admin/panier-live', label: 'Comportement clients', icon: Circle },
    ...(superOps ? [
      { to: '/admin/systeme', label: 'État services', icon: Server },
      { to: '/admin/files-attente', label: "Files d'attente", icon: ListTodo },
    ] : []),
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
