import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Star, ChevronRight, Clock, LogOut, UserCircle, ShoppingBag, MessageCircle, PackageSearch, MapPin } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api, peekCacheV1 } from '../api/client'
import { ORDER_STATUS_STYLES, orderStatusLabel } from '../lib/orderStatus'

type Order = {
  order_number: string
  status: string
  status_label?: string
  total: number
  created_at: string
}

export function Account() {
  const { user, logout, refresh } = useAuth()
  const [orders, setOrders] = useState<Order[]>(() =>
    peekCacheV1<{ orders: Order[] }>('/orders')?.orders ?? []
  )
  const [loading, setLoading] = useState(() => !peekCacheV1('/orders'))
  const [fidelityPoints, setFidelityPoints] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return

    const cached = peekCacheV1<{ orders: Order[] }>('/orders')
    if (cached) {
      setOrders(cached.orders)
      setLoading(false)
    }

    void refresh()
    api<{ rewards: { fidelity_points: number } }>('/rewards')
      .then((d) => setFidelityPoints(d.rewards.fidelity_points))
      .catch(() => setFidelityPoints(user.fidelity_points ?? 0))

    api<{ orders: Order[] }>('/orders')
      .then((d) => setOrders(d.orders))
      .finally(() => setLoading(false))
  }, [user, refresh])

  if (!user) {
    return (
      <div className="page-wrap py-16 text-center animate-fade-in">
        <div className="w-24 h-24 bg-brand-100 text-brand-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <UserCircle size={44} strokeWidth={1.5} />
        </div>
        <h1 className="font-display font-semibold text-2xl mb-3">Connectez-vous</h1>
        <p className="text-gray-500 mb-6">Accédez à votre compte pour suivre vos commandes.</p>
        <Link to="/connexion" className="btn-primary">Se connecter</Link>
      </div>
    )
  }

  return (
    <div className="page-wrap py-6 md:py-10 animate-fade-in">
      <div className="bg-gradient-to-r from-brand-600 to-brand-500 rounded-3xl p-6 md:p-8 mb-8 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-xl md:text-2xl truncate">Bonjour, {user.name}</h1>
            <p className="text-white/80 text-sm truncate">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <div className="bg-white/15 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star size={16} className="text-amber-300" />
              <span className="text-white/80 text-xs font-semibold">Points de fidélité</span>
            </div>
            <p className="font-bold text-2xl">
              {(fidelityPoints ?? user.fidelity_points ?? 0).toLocaleString('fr-FR')}
            </p>
            <Link to="/recompenses" className="text-[11px] text-white/80 hover:text-white underline mt-1 inline-block">
              Voir mes points de fidélité
            </Link>
          </div>
          <div className="bg-white/15 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package size={16} className="text-white/80" />
              <span className="text-white/80 text-xs font-semibold">Commandes</span>
            </div>
            <p className="font-bold text-2xl">{orders.length}</p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Mes récompenses', to: '/recompenses', icon: Star },
          { label: 'Continuer mes achats', to: '/produits', icon: ShoppingBag },
          { label: 'Suivre une commande', to: '/suivi', icon: PackageSearch },
          { label: 'Nous contacter', to: '/contact', icon: MessageCircle },
        ].map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow font-semibold text-gray-700"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center">
                  <Icon size={18} />
                </span>
                {item.label}
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </Link>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-display font-semibold text-ink text-lg flex items-center gap-2">
            <Package size={20} className="text-brand-500" />
            Mes commandes
          </h2>
        </div>

        {loading && orders.length === 0 ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="skeleton h-5 w-1/3 rounded" />
                <div className="skeleton h-5 w-1/4 rounded" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Clock size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="font-semibold text-gray-500 mb-4">Aucune commande pour le moment</p>
            <Link to="/produits" className="btn-primary btn-sm">Faire mon premier achat</Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {orders.map((o) => (
              <li key={o.order_number}>
                <Link
                  to={`/suivi/${o.order_number}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-sm group-hover:text-brand-600 transition-colors">
                      {o.order_number}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {new Date(o.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-bold text-gray-900 text-sm hidden sm:inline">
                      {Number(o.total).toFixed(3)} TND
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ORDER_STATUS_STYLES[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {o.status_label ?? orderStatusLabel(o.status)}
                    </span>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-400" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 bg-white rounded-2xl shadow-sm p-5 flex items-start gap-3">
        <MapPin size={20} className="text-brand-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-gray-900 text-sm">Adresses enregistrées</p>
          <p className="text-gray-500 text-xs mt-1">
            Vos adresses de livraison sont sauvegardées automatiquement à chaque commande et disponibles au checkout.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => logout()}
        className="mt-6 flex items-center gap-2 text-sm text-gray-400 hover:text-red-500 font-semibold transition-colors"
      >
        <LogOut size={16} />
        Se déconnecter
      </button>
    </div>
  )
}
