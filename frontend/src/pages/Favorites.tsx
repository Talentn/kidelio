import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, ArrowRight } from 'lucide-react'
import { api } from '../api/client'
import { ProductCard } from '../components/home/ProductCard'
import type { HomeProduct } from '../components/home/ProductCard'
import { useFavorites } from '../context/FavoritesContext'
import { SEO } from '../components/SEO'

export function Favorites() {
  const { ids } = useFavorites()
  const [products, setProducts] = useState<HomeProduct[]>([])
  const [loading, setLoading] = useState(ids.length > 0)

  const idsKey = useMemo(() => ids.join(','), [ids])

  useEffect(() => {
    if (ids.length === 0) {
      setProducts([])
      setLoading(false)
      return
    }

    setLoading(true)
    api<{ products: HomeProduct[] }>(`/products?ids=${idsKey}`)
      .then((data) => {
        const byId = new Map((data.products || []).map((p) => [p.id, p]))
        setProducts(ids.map((id) => byId.get(id)).filter((p): p is HomeProduct => !!p))
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [ids, idsKey])

  if (ids.length === 0) {
    return (
      <div className="page-wrap py-20 text-center animate-fade-in">
        <SEO title="Mes favoris" description="Retrouvez vos articles favoris sur Kidelio." />
        <div className="w-24 h-24 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Heart size={40} className="text-pink-400" />
        </div>
        <h1 className="font-display font-semibold text-2xl md:text-3xl text-ink mb-3">Aucun favori pour l'instant</h1>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto">
          Appuyez sur le cœur sur un produit pour l'enregistrer ici. Pas besoin de compte — vos favoris sont
          sauvegardés sur cet appareil.
        </p>
        <Link to="/produits" className="btn-primary btn-lg">
          Découvrir la boutique <ArrowRight size={18} />
        </Link>
      </div>
    )
  }

  return (
    <div className="page-wrap py-8 md:py-10">
      <SEO title="Mes favoris" description="Retrouvez vos articles favoris sur Kidelio." />
      <div className="mb-8">
        <h1 className="font-display font-semibold text-2xl md:text-3xl text-ink mb-2">Mes favoris</h1>
        <p className="text-gray-500 text-sm">
          {ids.length} article{ids.length > 1 ? 's' : ''} enregistré{ids.length > 1 ? 's' : ''} sur cet appareil
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(Math.min(ids.length, 4))].map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-gray-100">
              <div className="skeleton aspect-[3/4]" />
              <div className="p-3 space-y-2">
                <div className="skeleton h-4 rounded w-3/4" />
                <div className="skeleton h-4 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-sm">Les produits enregistrés ne sont plus disponibles.</p>
          <Link to="/produits" className="btn-primary btn-sm mt-4 inline-flex">
            Voir la boutique
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  )
}
