import { Link } from 'react-router-dom'
import { Shirt } from 'lucide-react'
import { prefetchV1 } from '../../api/client'

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
}

export function ProductCard({ p }: { p: HomeProduct }) {
  const discount =
    p.on_promo && p.promo_price && p.price
      ? Math.round((1 - Number(p.promo_price) / Number(p.price)) * 100)
      : 0

  return (
    <Link
      to={`/produits/${p.slug}`}
      className="product-card group"
      onMouseEnter={() => prefetchV1(`/products/${p.slug}`)}
    >
      <div className="product-img-wrap">
        {p.image_urls[0] ? (
          <img src={p.image_urls[0]} alt={p.name} loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-200">
            <Shirt size={40} strokeWidth={1.2} />
          </div>
        )}
        {!p.in_stock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="bg-gray-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full tracking-wide">
              Rupture de stock
            </span>
          </div>
        )}
        {discount > 0 && (
          <span className="absolute top-2.5 right-2.5 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
            -{discount}%
          </span>
        )}
        {p.age_group && (
          <span className="absolute top-2.5 left-2.5 bg-white/90 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
            {p.age_group}
          </span>
        )}
      </div>
      <div className="p-3 pb-4">
        <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 mb-1.5">{p.name}</h3>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-bold text-gray-900">
            {Number(p.effective_price).toFixed(3)}
            <span className="text-xs font-semibold text-gray-500 ml-0.5">TND</span>
          </span>
          {discount > 0 && p.price && (
            <span className="text-xs text-gray-400 line-through">
              {Number(p.price).toFixed(3)} TND
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
