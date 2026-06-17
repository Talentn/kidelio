import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Search, Loader2, PackageSearch } from 'lucide-react'
import { api, peekCacheV1 } from '../api/client'
import { OrderTracking, type TrackedOrder } from '../components/OrderTracking'
import { SEO } from '../components/SEO'

export function TrackOrder() {
  const { orderNumber: urlNumber } = useParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState(urlNumber?.toUpperCase() ?? '')
  const [order, setOrder] = useState<TrackedOrder | null>(() => {
    if (!urlNumber) return null
    return peekCacheV1<{ order: TrackedOrder }>(`/orders/track/${urlNumber.toUpperCase()}`)?.order ?? null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(!!urlNumber)

  const fetchOrder = async (num: string) => {
    const normalized = num.trim().toUpperCase()
    if (!normalized) return

    setLoading(true)
    setError('')
    setSearched(true)
    navigate(`/suivi/${normalized}`, { replace: true })

    try {
      const data = await api<{ order: TrackedOrder }>(`/orders/track/${encodeURIComponent(normalized)}`)
      setOrder(data.order)
    } catch (err: unknown) {
      setOrder(null)
      setError(err instanceof Error ? err.message : 'Commande introuvable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (urlNumber) {
      setQuery(urlNumber.toUpperCase())
      fetchOrder(urlNumber)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlNumber])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    fetchOrder(query)
  }

  return (
    <div className="page-wrap py-8 md:py-12 animate-fade-in">
      <SEO title="Suivre ma commande" url="/suivi" noIndex />
      <div className="max-w-xl mx-auto text-center mb-8">
        <div className="w-16 h-16 bg-brand-100 text-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <PackageSearch size={32} strokeWidth={1.5} />
        </div>
        <h1 className="font-display font-semibold text-2xl md:text-3xl text-ink mb-2">Suivre ma commande</h1>
        <p className="text-gray-500 text-sm">
          Entrez votre numéro de commande (ex. KS-20250531-AB12CD34) pour voir le statut de livraison.
        </p>
      </div>

      <form onSubmit={submit} className="max-w-xl mx-auto mb-10">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="KS-YYYYMMDD-XXXXXXXX"
            className="input flex-1 font-mono tracking-wide"
            required
          />
          <button type="submit" disabled={loading} className="btn-primary flex-shrink-0 px-5">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            <span className="hidden sm:inline">Rechercher</span>
          </button>
        </div>
      </form>

      {loading && !order && (
        <div className="max-w-xl mx-auto space-y-4">
          <div className="skeleton h-8 w-2/3 rounded mx-auto" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      )}

      {error && searched && !loading && (
        <div className="max-w-xl mx-auto alert-error text-center">{error}</div>
      )}

      {order && !loading && (
        <div className="max-w-xl mx-auto">
          <OrderTracking order={order} detailed={!!order.items?.length} />
        </div>
      )}

      <p className="text-center text-sm text-gray-400 mt-10">
        <Link to="/compte" className="text-brand-600 font-semibold hover:underline">
          Connectez-vous
        </Link>{' '}
        pour voir toutes vos commandes.
      </p>
    </div>
  )
}
