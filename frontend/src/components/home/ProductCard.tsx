import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, Heart, Check } from 'lucide-react'
import { prefetchV1 } from '../../api/client'
import { useCart } from '../../context/CartContext'
import { useFavorites } from '../../context/FavoritesContext'

export type HomeProduct = {
  id: number
  name: string
  slug: string
  price: number
  effective_price: number
  promo_price?: number
  on_promo: boolean
  image_urls: string[]
  age_group?: string
  in_stock: boolean
  // True when product has colors/sizes — quick-add goes to detail page
  has_variants?: boolean
}

export function ProductCard({ p }: { p: HomeProduct }) {
  const { addItem } = useCart()
  const navigate = useNavigate()
  const { isFavorite, toggle } = useFavorites()

  const [added, setAdded] = useState(false)
  const [adding, setAdding] = useState(false)

  const discount = p.on_promo && p.promo_price && p.price
    ? Math.round((1 - Number(p.promo_price) / Number(p.price)) * 100)
    : 0

  const isFav = isFavorite(p.id)

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Products with variants always go to detail page
    if (p.has_variants) {
      navigate(`/produits/${p.slug}`)
      return
    }
    if (!p.in_stock || adding) return
    setAdding(true)
    try {
      await addItem(p.id, 1, {})
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    } finally {
      setAdding(false)
    }
  }

  const handleFav = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggle(p.id, p.name)
  }

  return (
    <Link
      to={`/produits/${p.slug}`}
      className="product-card group"
      onMouseEnter={() => prefetchV1(`/products/${p.slug}`)}
    >
      <div className="product-img-wrap">
        {p.image_urls[0] ? (
          <img src={p.image_urls[0]} alt={p.name} loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-200 text-4xl">👕</div>
        )}

        {!p.in_stock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="bg-gray-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
              Rupture de stock
            </span>
          </div>
        )}

        {discount > 0 && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
            -{discount}%
          </span>
        )}

        {p.age_group && (
          <span className="absolute top-2 left-2 bg-white/90 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
            {p.age_group}
          </span>
        )}

        {/* ── Action buttons — always visible on mobile, on hover on desktop ── */}
        <div className="absolute bottom-2 left-2 right-2 flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 md:flex sm:opacity-0 max-sm:opacity-100 max-sm:translate-y-0">
          {/* Quick add */}
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={!p.in_stock || adding}
            aria-label="Ajouter au panier"
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl shadow transition-all
              ${added
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-900 hover:bg-brand-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
          >
            {added ? <Check size={14} /> : <ShoppingCart size={14} />}
            {added ? 'Ajouté' : p.has_variants ? 'Choisir' : 'Ajouter'}
          </button>

          {/* Favorite */}
          <button
            type="button"
            onClick={handleFav}
            aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className={`w-9 h-9 flex items-center justify-center rounded-xl shadow transition-all flex-shrink-0
              ${isFav ? 'bg-red-50 text-red-500' : 'bg-white text-gray-400 hover:text-red-400'}`}
          >
            <Heart size={15} fill={isFav ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <div className="p-3 pb-4">
        <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 mb-1.5">{p.name}</h3>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-bold text-gray-900">
            {Number(p.effective_price).toFixed(3)}
            <span className="text-xs font-semibold text-gray-500 ml-0.5">TND</span>
          </span>
          {discount > 0 && p.price && (
            <span className="text-xs text-gray-500 line-through">
              {Number(p.price).toFixed(3)} TND
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
