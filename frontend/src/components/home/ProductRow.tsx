import { Link } from 'react-router-dom'
import { ArrowRight, Shirt } from 'lucide-react'
import { ProductCard, type HomeProduct } from './ProductCard'

export function ProductRow({
  title,
  subtitle,
  viewAllHref,
  products,
  loading,
  bg = 'muted',
}: {
  title: string
  subtitle: string
  viewAllHref: string
  products: HomeProduct[]
  loading: boolean
  bg?: 'white' | 'muted'
}) {
  if (!loading && products.length === 0) return null

  return (
    <section className={bg === 'muted' ? 'bg-[#FAFAF9] py-10 md:py-14' : 'py-10 md:py-14'}>
      <div className="page-wrap">
        <div className="flex items-end justify-between mb-6 md:mb-8">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900">{title}</h2>
            <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
          </div>
          <Link
            to={viewAllHref}
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-gray-900 hover:text-brand-600 transition-colors border-b-2 border-gray-900 hover:border-brand-600 pb-0.5"
          >
            Tout voir <ArrowRight size={15} />
          </Link>
        </div>

        {loading && products.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden">
                <div className="skeleton aspect-[3/4]" />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-3.5 rounded w-3/4" />
                  <div className="skeleton h-3.5 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 animate-fade-in">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}

        {!loading && products.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Shirt size={36} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">Bientôt disponible</p>
          </div>
        )}

        <div className="text-center mt-8 sm:hidden">
          <Link
            to={viewAllHref}
            className="inline-flex items-center gap-2 bg-gray-900 text-white font-bold px-7 py-3 rounded-full text-sm"
          >
            Tout voir <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  )
}
