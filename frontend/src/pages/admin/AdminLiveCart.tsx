import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ShoppingCart, RefreshCw, ShoppingBag, Circle, Heart,
  Eye, Search, CreditCard, Globe, AlertTriangle,
} from 'lucide-react'
import { AdminPage } from '../../components/admin/ui'
import { apiAdmin } from '../../lib/api'
import { goWsUrl, goGet, goWsEnabled } from '../../lib/goApi'
import { formatDurationMs } from '../../lib/userTracking'
import { useLivePoll } from '../../hooks/useLivePoll'

const LIVE_POLL_MS = import.meta.env.PROD ? 15_000 : 5_000
const LIVE_EVENT_LIMIT = 75

type CartEvent = {
  id: string
  user_id: number | null
  session_id: string
  action: string
  product_id: number | null
  product_name: string
  quantity: number
  price: number
  color_id?: number | null
  color_label?: string
  size_label?: string
  created_at: string
  user_name?: string
}

type FavoriteEvent = {
  id: string
  user_id: number | null
  session_id: string
  action: string
  product_id: number | null
  product_name: string
  created_at: string
  user_name?: string
}

type UserEvent = {
  id: string
  user_id: number | null
  session_id: string
  event_type: string
  path: string
  product_id: number | null
  product_name: string
  metadata: string
  created_at: string
  user_name?: string
}

type Tab = 'all' | 'cart' | 'favorites' | 'navigation'

type FeedItem =
  | { kind: 'cart'; event: CartEvent }
  | { kind: 'favorite'; event: FavoriteEvent }
  | { kind: 'user'; event: UserEvent }

const CART_ACTION_COLORS: Record<string, string> = {
  add: 'bg-green-100 text-green-700',
  remove: 'bg-red-100 text-red-600',
  update: 'bg-amber-100 text-amber-700',
  clear: 'bg-gray-100 text-gray-600',
}

const CART_ACTION_LABELS: Record<string, string> = {
  add: 'Ajout panier',
  remove: 'Retiré panier',
  update: 'Qté modifiée',
  clear: 'Panier vidé',
}

const FAV_ACTION_COLORS: Record<string, string> = {
  add: 'bg-pink-100 text-pink-700',
  remove: 'bg-gray-100 text-gray-600',
}

const USER_EVENT_META: Record<string, { label: string; color: string; icon: typeof Globe }> = {
  page_view: { label: 'Page visitée', color: 'bg-blue-100 text-blue-700', icon: Globe },
  page_leave: { label: 'Temps sur page', color: 'bg-teal-100 text-teal-700', icon: Globe },
  product_view: { label: 'Produit consulté', color: 'bg-indigo-100 text-indigo-700', icon: Eye },
  search: { label: 'Recherche', color: 'bg-violet-100 text-violet-700', icon: Search },
  checkout_start: { label: 'Checkout', color: 'bg-orange-100 text-orange-700', icon: CreditCard },
}

function parseMetadata(raw: string): Record<string, unknown> | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function actorLabel(ev: { user_name?: string; session_id: string }) {
  return ev.user_name ? `👤 ${ev.user_name}` : `Session ${ev.session_id.slice(0, 8)}`
}

function variantLine(ev: CartEvent) {
  const parts: string[] = []
  if (ev.color_label) parts.push(`Couleur: ${ev.color_label}`)
  if (ev.size_label) parts.push(`Taille: ${ev.size_label}`)
  return parts.length ? parts.join(' · ') : null
}

export function AdminLiveCart() {
  const [tab, setTab] = useState<Tab>('all')
  const [goServiceError, setGoServiceError] = useState(false)
  const [cartError, setCartError] = useState(false)

  const [cartEvents, setCartEvents] = useState<CartEvent[]>([])
  const [favEvents, setFavEvents] = useState<FavoriteEvent[]>([])
  const [userEvents, setUserEvents] = useState<UserEvent[]>([])

  const [favWsLive, setFavWsLive] = useState(false)

  const refreshCart = useCallback(() =>
    apiAdmin<{ events: CartEvent[] }>(`/cart-live-events?limit=${LIVE_EVENT_LIMIT}`)
      .then((data) => { setCartEvents(data.events || []); setCartError(false) })
      .catch(() => setCartError(true)),
  [])

  const refreshFavorites = useCallback(() =>
    goGet<{ events: FavoriteEvent[] }>(`/favorites/admin/events?limit=${LIVE_EVENT_LIMIT}`)
      .then((data) => { setFavEvents(data.events || []); setGoServiceError(false) })
      .catch(() => setGoServiceError(true)),
  [])

  const refreshUserEvents = useCallback(() =>
    goGet<{ events: UserEvent[] }>(`/tracking/admin/events?limit=${LIVE_EVENT_LIMIT}`)
      .then((data) => { setUserEvents(data.events || []); setGoServiceError(false) })
      .catch(() => setGoServiceError(true)),
  [])

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshCart(), refreshFavorites(), refreshUserEvents()])
  }, [refreshCart, refreshFavorites, refreshUserEvents])

  // Initial load + manual refresh only for "all" tab polling below
  useEffect(() => { refreshAll() }, [refreshAll])

  useLivePoll(refreshCart, [refreshCart], { interval: LIVE_POLL_MS })
  useLivePoll(refreshFavorites, [refreshFavorites], {
    interval: LIVE_POLL_MS,
    enabled: tab === 'all' || tab === 'favorites',
  })
  useLivePoll(refreshUserEvents, [refreshUserEvents], {
    interval: LIVE_POLL_MS,
    enabled: tab === 'all' || tab === 'navigation',
  })

  // Optional live WebSocket for favorites
  useEffect(() => {
    if (!goWsEnabled()) return
    const ws = new WebSocket(goWsUrl('/favorites/admin/ws'))
    ws.onopen = () => setFavWsLive(true)
    ws.onerror = () => ws.close()
    ws.onclose = () => setFavWsLive(false)
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'history') setFavEvents(data.events || [])
      else if (data.type === 'favorite_event') {
        setFavEvents((prev) => [{ ...data.event, user_name: data.user_name }, ...prev].slice(0, 200))
      }
    }
    return () => ws.close()
  }, [])

  // Optional live WebSocket for user navigation events
  const userWsLive = useRef(false)
  useEffect(() => {
    if (!goWsEnabled()) return
    const ws = new WebSocket(goWsUrl('/tracking/admin/ws'))
    ws.onopen = () => { userWsLive.current = true }
    ws.onclose = () => { userWsLive.current = false }
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'history') setUserEvents(data.events || [])
      else if (data.type === 'user_event') {
        setUserEvents((prev) => [{ ...data.event, user_name: data.user_name }, ...prev].slice(0, 200))
      }
    }
    return () => ws.close()
  }, [])

  const mergedFeed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...cartEvents.map((event) => ({ kind: 'cart' as const, event })),
      ...favEvents.map((event) => ({ kind: 'favorite' as const, event })),
      ...userEvents.map((event) => ({ kind: 'user' as const, event })),
    ]
    items.sort((a, b) => new Date(b.event.created_at).getTime() - new Date(a.event.created_at).getTime())
    return items.slice(0, 250)
  }, [cartEvents, favEvents, userEvents])

  const filteredFeed = useMemo(() => {
    if (tab === 'all') return mergedFeed
    if (tab === 'cart') return mergedFeed.filter((i) => i.kind === 'cart')
    if (tab === 'favorites') return mergedFeed.filter((i) => i.kind === 'favorite')
    return mergedFeed.filter((i) => i.kind === 'user')
  }, [mergedFeed, tab])

  const cartAdds = cartEvents.filter((e) => e.action === 'add').length
  const sessions = new Set([
    ...cartEvents.map((e) => e.session_id),
    ...favEvents.map((e) => e.session_id),
    ...userEvents.map((e) => e.session_id),
  ]).size

  const wsConnected = !goWsEnabled() || favWsLive
  const statusOk = !cartError && !goServiceError

  return (
    <AdminPage
      title="Suivi clients en direct"
      subtitle="Panier (taille & couleur), favoris, navigation et checkout"
      actions={
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${statusOk ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            <Circle size={7} fill="currentColor" />
            {statusOk ? (wsConnected ? 'En direct' : 'Polling actif') : 'Partiellement indisponible'}
          </span>
          <button onClick={refreshAll} className="btn-sm btn-secondary flex items-center gap-1.5">
            <RefreshCw size={14} /> Actualiser
          </button>
        </div>
      }
    >
      {cartError && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Impossible de charger les événements panier.</p>
            <p className="text-red-800 mt-0.5">Vérifiez que la migration <code className="text-xs">cart_live_events</code> a été exécutée (<code className="text-xs">rails db:migrate</code>).</p>
          </div>
        </div>
      )}

      {goServiceError && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Le service temps réel (Go) ne répond pas.</p>
            <p className="text-amber-800 mt-0.5">Favoris et navigation nécessitent go-service. Le panier est enregistré par Rails et fonctionne sans Go.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { icon: ShoppingCart, label: 'Ajouts panier', value: cartAdds, color: 'text-green-600' },
          { icon: Heart, label: 'Favoris', value: favEvents.filter((e) => e.action === 'add').length, color: 'text-pink-500' },
          { icon: Eye, label: 'Vues produit', value: userEvents.filter((e) => e.event_type === 'product_view').length, color: 'text-indigo-600' },
          { icon: ShoppingBag, label: 'Sessions actives', value: sessions, color: 'text-brand-600' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center ${color}`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {([
          { id: 'all' as const, label: 'Tout', icon: Globe },
          { id: 'cart' as const, label: 'Panier', icon: ShoppingCart },
          { id: 'favorites' as const, label: 'Favoris', icon: Heart },
          { id: 'navigation' as const, label: 'Navigation', icon: Eye },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === id ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-300'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Live feed */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="font-bold text-sm text-gray-700">Flux d'activité</p>
          <p className="text-xs text-gray-400">{filteredFeed.length} événements</p>
        </div>

        {filteredFeed.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">En attente d'activité…</p>
            <p className="text-xs mt-1">Ajoutez un produit au panier depuis la boutique pour tester.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {filteredFeed.map((item) => {
              if (item.kind === 'cart') {
                const ev = item.event
                const variant = variantLine(ev)
                return (
                  <div key={`c-${ev.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${CART_ACTION_COLORS[ev.action] || 'bg-gray-100 text-gray-500'}`}>
                      {CART_ACTION_LABELS[ev.action] || ev.action}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {ev.product_name || `Produit #${ev.product_id}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {actorLabel(ev)}
                        {ev.quantity > 0 && ` · ×${ev.quantity}`}
                        {ev.price > 0 && ` · ${Number(ev.price).toFixed(3)} TND`}
                      </p>
                      {variant && (
                        <p className="text-xs text-brand-600 font-medium mt-0.5">{variant}</p>
                      )}
                    </div>
                    <time className="text-[11px] text-gray-400 flex-shrink-0">{formatTime(ev.created_at)}</time>
                  </div>
                )
              }

              if (item.kind === 'favorite') {
                const ev = item.event
                return (
                  <div key={`f-${ev.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${FAV_ACTION_COLORS[ev.action] || 'bg-gray-100 text-gray-500'}`}>
                      {ev.action === 'add' ? 'Favori' : 'Retiré'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {ev.product_name || `Produit #${ev.product_id}`}
                      </p>
                      <p className="text-xs text-gray-400">{actorLabel(ev)}</p>
                    </div>
                    <time className="text-[11px] text-gray-400 flex-shrink-0">{formatTime(ev.created_at)}</time>
                  </div>
                )
              }

              const ev = item.event
              const meta = USER_EVENT_META[ev.event_type] ?? { label: ev.event_type, color: 'bg-gray-100 text-gray-600', icon: Globe }
              const parsed = parseMetadata(ev.metadata)
              return (
                <div key={`u-${ev.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${meta.color}`}>
                    {meta.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {ev.product_name || ev.path || '—'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {actorLabel(ev)}
                      {ev.event_type === 'page_leave' && parsed?.duration_ms != null && (
                        <span className="text-teal-600 font-semibold">
                          {' '}· {formatDurationMs(Number(parsed.duration_ms))}
                          {parsed.reason === 'close' ? ' (onglet fermé)' : ''}
                          {parsed.reason === 'background' ? ' (app en arrière-plan)' : ''}
                        </span>
                      )}
                      {ev.event_type === 'search' && parsed?.query != null && ` · « ${String(parsed.query)} » (${parsed.result_count ?? '?'} résultats)`}
                      {ev.event_type === 'checkout_start' && parsed != null && ` · ${parsed.item_count ?? '?'} article(s) · ${Number(parsed.total ?? 0).toFixed(3)} TND`}
                    </p>
                  </div>
                  <time className="text-[11px] text-gray-400 flex-shrink-0">{formatTime(ev.created_at)}</time>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminPage>
  )
}
