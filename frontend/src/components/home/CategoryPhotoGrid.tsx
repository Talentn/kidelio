import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { ShopCategory } from '../../lib/categories'

export type { ShopCategory } from '../../lib/categories'

function tilesFromTree(categories: ShopCategory[]): ShopCategory[] {
  const out: ShopCategory[] = []
  for (const root of categories) {
    out.push(root)
    for (const ch of root.children ?? []) {
      out.push({ id: ch.id, name: ch.name, slug: ch.slug, image_url: ch.image_url })
    }
  }
  return out
}

const FALLBACK_IMAGE: Record<string, string> = {
  bebe: '/banner-babies.png',
  bebes: '/banner-babies.png',
  baby: '/banner-babies.png',
  jouets: '/banner-toys.png',
  jouet: '/banner-toys.png',
  enfant: '/banner-collection.png',
  ecole: '/banner-collection.png',
}

function categoryImage(
  cat: ShopCategory,
  assets?: Record<string, string | null | undefined>
): string | undefined {
  return (
    cat.image_url ||
    FALLBACK_IMAGE[cat.slug.toLowerCase()] ||
    assets?.banner_collection ||
    '/banner-collection.png'
  )
}

export function CategoryPhotoGrid({
  categories,
  assets,
}: {
  categories: ShopCategory[]
  assets?: Record<string, string | null | undefined>
}) {
  if (categories.length === 0) return null

  const shown = tilesFromTree(categories).slice(0, 6)

  return (
    <section className="page-wrap py-8 md:py-10">
      <div className="flex items-end justify-between mb-5 md:mb-6">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900">Nos univers</h2>
          <p className="text-gray-500 text-sm mt-0.5">Parcourez nos catégories</p>
        </div>
        <Link
          to="/produits"
          className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-gray-900 hover:text-brand-600 transition-colors"
        >
          Tout voir <ArrowRight size={15} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {shown.map((cat) => (
          <Link
            key={cat.id}
            to={`/produits?category=${cat.id}`}
            className="group relative overflow-hidden rounded-2xl aspect-[3/4] bg-gray-100 shadow-sm hover:shadow-lg transition-shadow"
          >
            <img
              src={categoryImage(cat, assets)}
              alt={cat.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
              <p className="font-display font-bold text-white text-sm md:text-base leading-tight">{cat.name}</p>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white/90 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                Explorer <ArrowRight size={12} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
