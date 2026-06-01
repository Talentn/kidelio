import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Tag, Shirt, Banknote, ChevronLeft } from 'lucide-react'
import { useCart, type CartVariant } from '../context/CartContext'

export function Cart() {
  const { items, loading, updateQty, removeItem, total } = useCart()

  const shipping = total >= 200 ? 0 : 7
  const grandTotal = total + shipping

  const variantOf = (item: (typeof items)[number]): CartVariant => ({
    colorId: item.colorId,
    colorLabel: item.colorLabel,
    sizeLabel: item.sizeLabel,
  })

  if (loading && items.length === 0) {
    return (
      <div className="page-wrap py-10 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-4 bg-white rounded-2xl p-4">
            <div className="skeleton w-24 h-24 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 rounded w-2/3" />
              <div className="skeleton h-4 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="page-wrap py-20 text-center animate-fade-in">
        <div className="w-24 h-24 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingBag size={40} className="text-brand-400" />
        </div>
        <h1 className="font-display font-semibold text-2xl md:text-3xl text-ink mb-3">Votre panier est vide</h1>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto">
          Découvrez nos collections et ajoutez vos articles préférés pour commencer vos achats.
        </p>
        <Link to="/produits" className="btn-primary btn-lg">
          Découvrir la boutique <ArrowRight size={18} />
        </Link>
      </div>
    )
  }

  return (
    <div className="page-wrap py-6 md:py-10">
      <h1 className="font-display text-2xl md:text-3xl font-semibold text-ink mb-8">
        Mon panier
        <span className="ml-2 text-base font-semibold text-gray-400">
          ({items.length} article{items.length > 1 ? 's' : ''})
        </span>
      </h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <div
              key={`${item.productId}-${item.colorId ?? item.colorLabel}-${item.sizeLabel}`}
              className="flex gap-4 bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow animate-fade-in"
            >
              {/* Thumbnail */}
              <div className="w-20 h-20 xs:w-24 xs:h-24 flex-shrink-0 rounded-xl overflow-hidden bg-brand-50 text-brand-200 flex items-center justify-center">
                {item.imageUrl
                  ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  : <Shirt size={30} strokeWidth={1.5} />}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 leading-tight line-clamp-2 mb-0.5 text-sm xs:text-base">{item.name}</h3>
                {(item.colorLabel || item.sizeLabel) && (
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    {item.colorLabel && (
                      <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.colorLabel}</span>
                    )}
                    {item.sizeLabel && (
                      <span className="text-[11px] font-semibold bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">{item.sizeLabel}</span>
                    )}
                  </div>
                )}
                <p className="text-brand-600 font-bold mb-2 xs:mb-3">
                  {item.price.toFixed(3)} <span className="text-xs font-bold">TND</span>
                </p>

                <div className="flex items-center justify-between">
                  {/* Qty controls */}
                  <div className="inline-flex items-center gap-0 border-2 border-gray-200 rounded-full overflow-hidden">
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, item.quantity - 1, variantOf(item))}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30"
                      disabled={item.quantity <= 1}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-gray-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, item.quantity + 1, variantOf(item))}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900 text-sm">
                      {(item.price * item.quantity).toFixed(3)} TND
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId, variantOf(item))}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label="Retirer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <Link
            to="/produits"
            className="inline-flex items-center gap-1.5 text-brand-600 font-semibold text-sm hover:text-brand-800 transition-colors mt-2"
          >
            <ChevronLeft size={16} /> Continuer vos achats
          </Link>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1 order-first lg:order-last">
          <div className="bg-white rounded-2xl shadow-sm p-5 xs:p-6 lg:sticky lg:top-24">
            <h2 className="font-display font-semibold text-ink text-lg mb-5">Résumé de commande</h2>

            <div className="space-y-3 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-gray-600">Sous-total</span>
                <span className="font-bold">{total.toFixed(3)} TND</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Livraison</span>
                <span className={`font-bold ${shipping === 0 ? 'text-sage-600' : ''}`}>
                  {shipping === 0 ? 'Gratuite' : `${shipping.toFixed(3)} TND`}
                </span>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-gray-400 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <Tag size={12} className="text-amber-500" />
                  Plus que {(200 - total).toFixed(3)} TND pour la livraison gratuite !
                </p>
              )}
              <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-brand-600">{grandTotal.toFixed(3)} TND</span>
              </div>
            </div>

            <Link
              to="/checkout"
              className="btn-primary w-full justify-center text-base py-4"
            >
              Commander maintenant <ArrowRight size={18} />
            </Link>

            <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400 justify-center">
              <Banknote size={14} />
              Paiement à la livraison — sécurisé et sans frais
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
