import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle, Home, ShoppingBag, Loader2, PackageSearch } from 'lucide-react'
import { api, peekCacheV1 } from '../api/client'
import { OrderTracking, type TrackedOrder } from '../components/OrderTracking'

export function OrderSuccess() {
  const { orderNumber } = useParams()
  const [order, setOrder] = useState<TrackedOrder | null>(() => {
    if (!orderNumber) return null
    return peekCacheV1<{ order: TrackedOrder }>(`/orders/track/${orderNumber.toUpperCase()}`)?.order ?? null
  })
  const [loading, setLoading] = useState(!order)

  useEffect(() => {
    if (!orderNumber) return

    api<{ order: TrackedOrder }>(`/orders/track/${encodeURIComponent(orderNumber.toUpperCase())}`)
      .then((d) => setOrder(d.order))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orderNumber])

  return (
    <div className="page-wrap py-10 md:py-16 animate-scale-in">
      <div className="text-center mb-10">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 bg-sage-100 rounded-full animate-ping opacity-30" />
          <div className="relative w-24 h-24 bg-sage-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={48} className="text-sage-600" />
          </div>
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-3">
          Commande confirmée
        </h1>
        <p className="text-gray-500 text-base max-w-md mx-auto">
          Merci ! Votre commande a bien été reçue. Conservez votre numéro de suivi ci-dessous.
        </p>
      </div>

      {loading && !order ? (
        <div className="max-w-xl mx-auto space-y-4">
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      ) : order ? (
        <div className="max-w-xl mx-auto mb-10">
          <OrderTracking order={order} detailed />
        </div>
      ) : (
        <div className="inline-flex flex-col items-center bg-white rounded-2xl shadow-sm px-8 py-6 mb-10 border border-sage-200 mx-auto">
          <p className="font-bold text-2xl text-ink tracking-widest">{orderNumber}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
        {orderNumber && (
          <Link to={`/suivi/${orderNumber}`} className="btn-secondary btn-lg">
            <PackageSearch size={18} />
            Suivre ma livraison
          </Link>
        )}
        <Link to="/" className="btn-primary btn-lg">
          <Home size={18} />
          Retour à l'accueil
        </Link>
        <Link to="/produits" className="btn-secondary btn-lg">
          <ShoppingBag size={18} />
          Continuer mes achats
        </Link>
      </div>

      {loading && (
        <p className="text-center text-sm text-gray-400 flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Chargement du suivi...
        </p>
      )}

      <p className="text-center text-sm text-gray-400">
        Des questions ?{' '}
        <Link to="/contact" className="text-brand-600 font-semibold hover:underline">
          Contactez-nous
        </Link>
      </p>
    </div>
  )
}
