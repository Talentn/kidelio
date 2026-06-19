import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { scrollWindowToTop } from '../lib/scrollToTop'
import { Link, useParams } from 'react-router-dom'
import {
  ShoppingCart, ChevronLeft, Minus, Plus, Check, Heart,
  Shirt, Truck, Banknote, ShieldCheck, PackageCheck, Frown,
} from 'lucide-react'
import { api, peekCacheV1 } from '../api/client'
import { useCart } from '../context/CartContext'
import { useFavorites } from '../context/FavoritesContext'
import { useUI } from '../context/UIContext'
import { trackAddToCart, trackViewContent, isPixelReady, onPixelReady } from '../lib/metaPixel'
import { trackProductView } from '../lib/userTracking'
import { SEO } from '../components/SEO'
import { ProductStarRating, type ProductRating } from '../components/ProductStarRating'
import { useStore } from '../context/StoreContext'
import { buildProductJsonLd, type ProductReviewPreview } from '../lib/productSchema'

type ColorSize = { size: string; stock: number }

type ProductColor = {
  id: number
  name: string
  hex?: string
  position?: number
  thumbnail_url?: string
  image_urls: string[]
  sizes?: ColorSize[]
}

type Product = {
  id: number
  name: string
  slug: string
  description?: string
  price: number
  promo_price?: number
  effective_price: number
  on_promo: boolean
  in_stock: boolean
  stock: number
  image_urls: string[]
  age_group?: string
  category?: { id: number; name: string; slug: string }
  colors?: ProductColor[]
  rating?: ProductRating
  reviews_preview?: ProductReviewPreview[]
}

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>()
  const productPath = slug ? `/products/${slug}` : null
  const cachedProduct = productPath ? peekCacheV1<{ product: Product }>(productPath) : null

  const [product, setProduct] = useState<Product | null>(() => cachedProduct?.product ?? null)
  const [loading, setLoading] = useState(() => !cachedProduct)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const [colorId, setColorId] = useState<number | null>(null)
  const [size, setSize] = useState<string | null>(null)
  const [activeImage, setActiveImage] = useState(0)
  const [rating, setRating] = useState<ProductRating>({ average: 0, count: 0 })

  const { addItem } = useCart()
  const { openCart } = useUI()
  const { isFavorite, toggle } = useFavorites()
  const { config: storeConfig } = useStore()

  const sortedColors = useMemo(
    () =>
      [...(product?.colors ?? [])].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id,
      ),
    [product?.colors],
  )

  useLayoutEffect(() => {
    scrollWindowToTop()
  }, [slug])

  useEffect(() => {
    if (!slug || !productPath) return

    const applyProduct = (p: Product) => {
      setProduct(p)
      setRating(p.rating ?? { average: 0, count: 0 })
      const ordered = [...(p.colors ?? [])].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id,
      )
      setColorId(ordered[0]?.id ?? null)
      setSize(null)
      setActiveImage(0)
    }

    const cached = peekCacheV1<{ product: Product }>(productPath)
    if (cached) {
      applyProduct(cached.product)
      setLoading(false)
    } else {
      setLoading(true)
    }

    api<{ product: Product }>(productPath)
      .then((d) => {
        applyProduct(d.product)
      })
      .catch((err: unknown) => {
        console.error('[ProductDetail] fetch failed:', err)
        setProduct(null)
      })
      .finally(() => {
        setLoading(false)
        scrollWindowToTop()
        window.requestAnimationFrame(scrollWindowToTop)
      })
  }, [slug, productPath])

  useEffect(() => {
    if (!product) return
    trackProductView(product.id, product.name, product.slug)
  }, [product?.id])

  useEffect(() => {
    if (!product) return
    const color = product.colors?.find((c) => c.id === colorId) ?? sortedColors[0]
    const sizeLabel = size ?? color?.sizes?.[0]?.size
    const track = () =>
      trackViewContent({
        id: product.id,
        name: product.name,
        price: product.price,
        effective_price: product.effective_price,
        on_promo: product.on_promo,
        in_stock: product.in_stock,
        category: product.category?.name,
        age_group: product.age_group,
        colors: product.colors,
        colorId: color?.id,
        sizeLabel,
      })
    if (isPixelReady()) track()
    return onPixelReady(track)
  }, [product, colorId, size, sortedColors])

  const selectedColor = useMemo(
    () => product?.colors?.find((c) => c.id === colorId) ?? null,
    [product, colorId],
  )

  const availableSizes = useMemo(
    () => selectedColor?.sizes ?? [],
    [selectedColor],
  )

  // When user switches color, reset size choice.
  const selectColor = (id: number) => {
    setColorId(id)
    setSize(null)
    setActiveImage(0)
  }

  // Gallery: selected color's images when available, else product-level gallery.
  const gallery = useMemo(() => {
    if (selectedColor && selectedColor.image_urls.length > 0) return selectedColor.image_urls
    return product?.image_urls ?? []
  }, [selectedColor, product])

  // Effective stock for the current selection.
  const effectiveStock = useMemo(() => {
    if (size && availableSizes.length > 0) {
      return availableSizes.find((s) => s.size === size)?.stock ?? 0
    }
    if (selectedColor && availableSizes.length === 0) return product?.stock ?? 0
    if (selectedColor && availableSizes.length > 0 && !size) return null   // need a size
    return product?.stock ?? 0
  }, [size, availableSizes, selectedColor, product])

  // Is "add to cart" enabled?
  const hasColors = sortedColors.length > 0
  const needsSize = availableSizes.length > 0
  const canAdd =
    product?.in_stock !== false &&
    (!hasColors || colorId !== null) &&
    (!needsSize || (size !== null && (effectiveStock ?? 0) > 0))

  if (loading && !product) {
    return (
      <div className="page-wrap py-8">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <div className="skeleton aspect-square rounded-2xl" />
          <div className="space-y-4">
            <div className="skeleton h-8 rounded w-3/4" />
            <div className="skeleton h-6 rounded w-1/4" />
            <div className="skeleton h-24 rounded" />
            <div className="skeleton h-12 rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="page-wrap py-16 text-center">
        <SEO title="Produit introuvable" noIndex />
        <Frown size={48} strokeWidth={1.5} className="text-gray-300 mx-auto mb-4" />
        <h1 className="font-display font-semibold text-2xl mb-4">Produit introuvable</h1>
        <Link to="/produits" className="btn-primary">Retour à la boutique</Link>
      </div>
    )
  }

  const handleAdd = async () => {
    if (!canAdd) return
    setAdding(true)
    setAddError('')
    try {
      await addItem(product.id, qty, {
        colorId: selectedColor?.id,
        colorLabel: selectedColor?.name,
        sizeLabel: size ?? undefined,
      })
      trackAddToCart({
        productId: product.id,
        name: product.name,
        price: product.effective_price,
        quantity: qty,
        category: product.category?.name,
        on_promo: product.on_promo,
        colorId: selectedColor?.id,
        sizeLabel: size ?? undefined,
      })
      setAdded(true)
      openCart()
      setTimeout(() => setAdded(false), 2500)
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Impossible d\'ajouter au panier.')
    } finally {
      setAdding(false)
    }
  }

  const adjustQty = (delta: number) => {
    const max = effectiveStock ?? product.stock ?? 99
    setQty((q) => Math.min(Math.max(1, q + delta), max))
  }

  const mainImage = gallery[activeImage] ?? gallery[0]
  const selectedSize = availableSizes.find((s) => s.size === size)

  const productImage = gallery[0] ?? product.image_urls[0]
  const productJsonLd = buildProductJsonLd(
    product,
    rating,
    product.reviews_preview ?? [],
    storeConfig?.shipping_cost ?? 7,
  )

  return (
    <div className="page-wrap py-6 md:py-10">
      <SEO
        title={product.name}
        description={product.description || `Achetez ${product.name} sur Kidelio. Livraison rapide en Tunisie, paiement à la livraison.`}
        image={productImage || undefined}
        url={`/produits/${product.slug}`}
        type="product"
        jsonLd={productJsonLd}
      />
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-brand-600 transition-colors">Accueil</Link>
        <span>/</span>
        <Link to="/produits" className="hover:text-brand-600 transition-colors">Boutique</Link>
        <span>/</span>
        <span className="text-gray-900 font-semibold truncate">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-16 animate-fade-in">
        {/* ── Image column ── */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <div className="aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-gray-50 to-brand-50 relative">
                {mainImage ? (
                  <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-brand-200">
                    <Shirt size={120} strokeWidth={1.2} />
                  </div>
                )}
                {!product.in_stock && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <span className="bg-ink text-white text-sm font-semibold px-5 py-2 rounded-full">
                      Rupture de stock
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Color variant thumbnails (order = admin #1, #2, …) */}
            {sortedColors.length > 1 && (
              <div className="flex flex-col gap-2 flex-shrink-0">
                {sortedColors.map((c) => {
                  const thumb = c.thumbnail_url || c.image_urls[0]
                  const isActive = c.id === colorId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectColor(c.id)}
                      title={c.name}
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all ${
                        isActive ? 'border-brand-500 ring-2 ring-brand-200' : 'border-gray-200 hover:border-brand-300'
                      }`}
                    >
                      {thumb ? (
                        <img src={thumb} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <span
                          className="w-full h-full block"
                          style={{ backgroundColor: c.hex || '#e5e7eb' }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Extra photos for the selected color */}
          {gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {gallery.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={`flex-shrink-0 w-14 h-14 xs:w-16 xs:h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-colors ${
                    i === activeImage ? 'border-brand-500' : 'border-transparent hover:border-brand-300'
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Info column ── */}
        <div className="flex flex-col">
          {product.age_group && <span className="tag w-fit mb-3">{product.age_group}</span>}

          <div className="flex items-start gap-3 mb-3">
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-ink leading-tight flex-1">
              {product.name}
            </h1>
            <button
              type="button"
              onClick={() => toggle(product.id, product.name)}
              aria-label={isFavorite(product.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full border-2 transition-colors ${
                isFavorite(product.id)
                  ? 'border-pink-200 bg-pink-50 text-pink-500'
                  : 'border-gray-200 text-gray-400 hover:border-pink-200 hover:text-pink-400'
              }`}
            >
              <Heart size={20} fill={isFavorite(product.id) ? 'currentColor' : 'none'} />
            </button>
          </div>

          <p className="text-2xl xs:text-3xl md:text-4xl font-bold text-brand-600 mb-4 xs:mb-5">
            {Number(product.effective_price).toFixed(3)}{' '}
            <span className="text-base xs:text-lg font-bold text-brand-400">TND</span>
          </p>

          {slug && (
            <ProductStarRating
              productSlug={slug}
              rating={rating}
              onRated={setRating}
            />
          )}

          {product.description && (
            <p className="text-gray-600 leading-relaxed mb-6 text-base">{product.description}</p>
          )}

          {/* ── Color picker ── */}
          {sortedColors.length > 0 && (
            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-2.5">
                Couleur
                {selectedColor && (
                  <span className="text-gray-400 font-medium"> · {selectedColor.name}</span>
                )}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {sortedColors.map((c) => {
                  const isActive = c.id === colorId
                  const thumb = c.thumbnail_url || c.image_urls[0]
                  const outOfStock = c.sizes && c.sizes.length > 0
                    ? c.sizes.every((s) => s.stock === 0)
                    : false

                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectColor(c.id)}
                      title={c.name}
                      disabled={outOfStock}
                      className={`relative flex items-center gap-2 rounded-full border-2 transition-all overflow-hidden ${
                        thumb ? 'p-0.5' : 'px-3 py-1.5'
                      } ${
                        isActive ? 'border-brand-500' : 'border-gray-200 hover:border-brand-300'
                      } ${outOfStock ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {thumb ? (
                        <img src={thumb} alt={c.name} className="w-8 h-8 rounded-full object-cover ring-1 ring-black/5" />
                      ) : c.hex ? (
                        <span
                          className="w-8 h-8 rounded-full block ring-1 ring-black/5"
                          style={{ backgroundColor: c.hex }}
                        />
                      ) : (
                        <span className="text-sm font-semibold text-gray-700 px-1">{c.name}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Size picker (only when the selected color has sizes) ── */}
          {availableSizes.length > 0 && (
            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-2.5">
                Taille
                {selectedSize && (
                  <span className="text-gray-400 font-medium"> · {selectedSize.size}</span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map((s) => {
                  const isActive = s.size === size
                  const oos = s.stock === 0
                  return (
                    <button
                      key={s.size}
                      type="button"
                      onClick={() => { if (!oos) setSize(s.size); setQty(1); }}
                      disabled={oos}
                      className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${
                        isActive
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : oos
                          ? 'border-gray-100 text-gray-300 cursor-not-allowed line-through'
                          : 'border-gray-200 text-gray-700 hover:border-brand-300'
                      }`}
                    >
                      {s.size}
                      {!oos && (
                        <span className="ml-1.5 text-xs font-normal text-gray-400">({s.stock})</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Stock indicator ── */}
          <div className="flex items-center gap-2 mb-6">
            {effectiveStock === null ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-sm font-semibold text-amber-600">Choisissez une taille</span>
              </>
            ) : effectiveStock > 0 ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-sage-500" />
                <span className="text-sm font-semibold text-sage-600">
                  {effectiveStock <= 5 ? `Plus que ${effectiveStock} en stock !` : 'En stock'}
                </span>
              </>
            ) : (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-sm font-semibold text-red-500">Rupture de stock</span>
              </>
            )}
          </div>

          {/* ── Quantity + add to cart ── */}
          {canAdd && (
            <>
              <div className="mb-5">
                <p className="text-sm font-semibold text-gray-700 mb-2">Quantité</p>
                <div className="inline-flex items-center border-2 border-gray-200 rounded-full overflow-hidden">
                  <button
                    type="button"
                    onClick={() => adjustQty(-1)}
                    disabled={qty <= 1}
                    className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-10 text-center font-bold text-gray-900">{qty}</span>
                  <button
                    type="button"
                    onClick={() => adjustQty(1)}
                    disabled={qty >= (effectiveStock ?? product.stock ?? 99)}
                    className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {addError && (
                <p className="text-sm text-red-600 font-medium mb-3">{addError}</p>
              )}

              <button
                type="button"
                onClick={handleAdd}
                disabled={adding}
                className={`btn-primary btn-lg w-full justify-center transition-all md:w-auto ${
                  added ? 'bg-sage-500 hover:bg-sage-600' : ''
                }`}
              >
                {added ? (
                  <><Check size={20} /> Ajouté au panier</>
                ) : adding ? (
                  <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Ajout...</>
                ) : (
                  <><ShoppingCart size={20} /> Ajouter au panier</>
                )}
              </button>
            </>
          )}

          {/* Prompt to complete selection */}
          {!canAdd && product.in_stock !== false && (
            <div className="rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-4 py-3 text-sm text-brand-700 font-semibold">
              {!hasColors || colorId !== null
                ? needsSize && !size
                  ? 'Choisissez une taille pour continuer'
                  : 'Ce produit est épuisé dans cette combinaison'
                : 'Choisissez une couleur pour continuer'}
            </div>
          )}

          {/* Trust info */}
          <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-2 gap-4">
            {[
              { icon: Truck,        text: 'Livraison partout en Tunisie' },
              { icon: Banknote,     text: 'Paiement à la livraison' },
              { icon: ShieldCheck,  text: 'Qualité garantie' },
              { icon: PackageCheck, text: 'Emballage soigné' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                <Icon size={16} className="text-brand-400 flex-shrink-0" />
                {text}
              </div>
            ))}
          </div>

          <Link
            to="/produits"
            className="inline-flex items-center gap-1.5 mt-6 text-sm text-gray-400 hover:text-brand-600 transition-colors font-semibold"
          >
            <ChevronLeft size={16} />
            Retour à la boutique
          </Link>
        </div>
      </div>
    </div>
  )
}
