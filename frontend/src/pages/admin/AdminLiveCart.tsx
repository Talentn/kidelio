import { useEffect, useRef, useState } from 'react'
import { ShoppingCart, Trash2, RefreshCw, ShoppingBag, Circle, Heart, HeartOff } from 'lucide-react'
import { AdminPage } from '../../components/admin/ui'
import { goWsUrl, goGet } from '../../lib/goApi'

type CartEvent = {
  id: string
  user_id: number | null
  session_id: string
  action: string
  product_id: number | null
  product_name: string
  quantity: number
  price: number
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

const CART_ACTION_COLORS: Record<string, string> = {
  add:    'bg-green-100 text-green-700',
  remove: 'bg-red-100 text-red-600',
  update: 'bg-amber-100 text-amber-700',
  clear:  'bg-gray-100 text-gray-600',
}

const CART_ACTION_LABELS: Record<string, string> = {
  add:    'Ajouté',
  remove: 'Retiré',
  update: 'Modifié',
  clear:  'Panier vidé',
}

const FAV_ACTION_COLORS: Record<string, string> = {
  add:    'bg-pink-100 text-pink-700',
  remove: 'bg-gray-100 text-gray-600',
}

const FAV_ACTION_LABELS: Record<string, string> = {
  add:    'Favori',
  remove: 'Retiré',
}

export function AdminLiveCart() {
  const [tab, setTab] = useState<'cart' | 'favorites'>('cart')

  const [cartEvents, setCartEvents] = useState<CartEvent[]>([])
  const [cartConnected, setCartConnected] = useState(false)
  const cartWsRef = useRef<WebSocket | null>(null)

  const [favEvents, setFavEvents] = useState<FavoriteEvent[]>([])
  const [favConnected, setFavConnected] = useState(false)
  const favWsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket(goWsUrl('/cart/admin/ws'))
    cartWsRef.current = ws
    ws.onopen  = () => setCartConnected(true)
    ws.onclose = () => setCartConnected(false)
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'history') {
        setCartEvents(data.events || [])
      } else if (data.type === 'cart_event') {
        setCartEvents(prev => [{ ...data.event, user_name: data.user_name }, ...prev].slice(0, 200))
      }
    }
    return () => ws.close()
  }, [])

  useEffect(() => {
    const ws = new WebSocket(goWsUrl('/favorites/admin/ws'))
    favWsRef.current = ws
    ws.onopen  = () => setFavConnected(true)
    ws.onclose = () => setFavConnected(false)
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'history') {
        setFavEvents(data.events || [])
      } else if (data.type === 'favorite_event') {
        setFavEvents(prev => [{ ...data.event, user_name: data.user_name }, ...prev].slice(0, 200))
      }
    }
    return () => ws.close()
  }, [])

  const refresh = async () => {
    if (tab === 'cart') {
      const data = await goGet<{ events: CartEvent[] }>('/cart/admin/events?limit=100')
      setCartEvents(data.events || [])
    } else {
      const data = await goGet<{ events: FavoriteEvent[] }>('/favorites/admin/events?limit=100')
      setFavEvents(data.events || [])
    }
  }

  const connected = tab === 'cart' ? cartConnected : favConnected
  const events = tab === 'cart' ? cartEvents : favEvents

  const cartAddCount    = cartEvents.filter(e => e.action === 'add').length
  const cartRemoveCount = cartEvents.filter(e => e.action === 'remove').length
  const cartSessions    = new Set(cartEvents.map(e => e.session_id)).size

  const favAddCount    = favEvents.filter(e => e.action === 'add').length
  const favRemoveCount = favEvents.filter(e => e.action === 'remove').length
  const favSessions    = new Set(favEvents.map(e => e.session_id)).size

  return (
    <AdminPage
      title="Activité en temps réel"
      subtitle="Suivez les ajouts panier et favoris en direct"
      actions={
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            <Circle size={7} fill="currentColor" />
            {connected ? 'En direct' : 'Déconnecté'}
          </span>
          <button onClick={refresh} className="btn-sm btn-secondary flex items-center gap-1.5">
            <RefreshCw size={14} /> Actualiser
          </button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([
          { id: 'cart' as const, label: 'Panier', icon: ShoppingCart },
          { id: 'favorites' as const, label: 'Favoris', icon: Heart },
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

      {/* Stats */}
      {tab === 'cart' ? (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { icon: ShoppingCart, label: 'Ajouts', value: cartAddCount, color: 'text-green-600' },
            { icon: Trash2,       label: 'Suppressions', value: cartRemoveCount, color: 'text-red-500' },
            { icon: ShoppingBag,  label: 'Sessions', value: cartSessions, color: 'text-brand-600' },
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
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { icon: Heart,    label: 'Ajouts favoris', value: favAddCount, color: 'text-pink-500' },
            { icon: HeartOff, label: 'Retraits', value: favRemoveCount, color: 'text-gray-500' },
            { icon: ShoppingBag, label: 'Sessions', value: favSessions, color: 'text-brand-600' },
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
      )}

      {/* Live feed */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="font-bold text-sm text-gray-700">
            {tab === 'cart' ? 'Flux panier' : 'Flux favoris'}
          </p>
          <p className="text-xs text-gray-400">{events.length} événements</p>
        </div>

        {events.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            {tab === 'cart'
              ? <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
              : <Heart size={32} className="mx-auto mb-2 opacity-30" />}
            <p className="text-sm">En attente d'activité...</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
            {tab === 'cart'
              ? cartEvents.map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${CART_ACTION_COLORS[ev.action] || 'bg-gray-100 text-gray-500'}`}>
                      {CART_ACTION_LABELS[ev.action] || ev.action}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {ev.product_name || `Produit #${ev.product_id}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {ev.user_name ? `👤 ${ev.user_name}` : `Session ${ev.session_id.slice(0, 8)}`}
                        {ev.quantity > 0 && ` · ×${ev.quantity}`}
                        {ev.price > 0 && ` · ${Number(ev.price).toFixed(3)} TND`}
                      </p>
                    </div>
                    <time className="text-[11px] text-gray-400 flex-shrink-0">
                      {new Date(ev.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </time>
                  </div>
                ))
              : favEvents.map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${FAV_ACTION_COLORS[ev.action] || 'bg-gray-100 text-gray-500'}`}>
                      {FAV_ACTION_LABELS[ev.action] || ev.action}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {ev.product_name || `Produit #${ev.product_id}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {ev.user_name ? `👤 ${ev.user_name}` : `Session ${ev.session_id.slice(0, 8)}`}
                      </p>
                    </div>
                    <time className="text-[11px] text-gray-400 flex-shrink-0">
                      {new Date(ev.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </time>
                  </div>
                ))}
          </div>
        )}
      </div>
    </AdminPage>
  )
}
