import { useEffect } from "react";
import { Link } from "react-router-dom";
import { X, Minus, Plus, Trash2, ShoppingBag, ArrowRight, Shirt } from "lucide-react";
import { useCart, type CartVariant } from "../context/CartContext";
import { useUI } from "../context/UIContext";

export function CartDrawer() {
  const { cartOpen, closeCart } = useUI();
  const { items, loading, updateQty, removeItem, total, count } = useCart();

  const shipping = total >= 200 ? 0 : 7;

  const variantOf = (item: (typeof items)[number]): CartVariant => ({
    colorId: item.colorId,
    colorLabel: item.colorLabel,
    sizeLabel: item.sizeLabel,
  });

  useEffect(() => {
    if (!cartOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCart();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [cartOpen, closeCart]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          cartOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeCart}
        aria-hidden
      />

      {/*
        Mobile:  bottom sheet — slides up from the bottom, max 92% of screen height
        Desktop: right panel  — slides in from the right, max-w-md
      */}
      <aside
        className={`
          fixed z-[101] bg-white shadow-2xl flex flex-col overscroll-contain
          bottom-0 left-0 right-0 max-h-[92dvh] rounded-t-3xl
          transition-transform duration-300 ease-out
          ${cartOpen ? "translate-y-0 pointer-events-auto" : "translate-y-full pointer-events-none"}
          sm:bottom-auto sm:top-0 sm:left-auto sm:right-0 sm:h-dvh sm:max-h-none
          sm:w-full sm:max-w-md sm:rounded-none
          ${cartOpen ? "sm:translate-x-0 sm:translate-y-0" : "sm:translate-x-full sm:translate-y-0"}
        `}
        role="dialog"
        aria-label="Panier"
      >
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <h2 className="flex items-center gap-2 font-bold text-gray-900 text-base sm:text-lg">
            <ShoppingBag size={19} className="text-brand-500" />
            Mon panier
            {count > 0 && (
              <span className="bg-brand-100 text-brand-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {count}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={closeCart}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="Fermer"
          >
            <X size={19} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-3">
          {loading && items.length === 0 ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="skeleton w-16 h-16 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="skeleton h-4 rounded w-2/3" />
                    <div className="skeleton h-3 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mb-4">
                <ShoppingBag size={28} className="text-brand-400" />
              </div>
              <p className="font-bold text-gray-900 mb-1">Votre panier est vide</p>
              <p className="text-gray-400 text-sm mb-5">Ajoutez vos articles préférés !</p>
              <Link to="/produits" onClick={closeCart} className="btn-primary btn-sm">
                Découvrir la boutique
              </Link>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {items.map((item) => (
                <li key={`${item.productId}-${item.colorId ?? item.colorLabel}-${item.sizeLabel}`}
                  className="flex gap-3 bg-gray-50 rounded-2xl p-3 animate-fade-in">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-brand-50 text-brand-200 flex items-center justify-center">
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      : <Shirt size={22} strokeWidth={1.5} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2">{item.name}</h3>
                        {(item.colorLabel || item.sizeLabel) && (
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {item.colorLabel && (
                              <span className="text-[11px] font-semibold bg-gray-200/80 text-gray-600 px-1.5 py-0.5 rounded-full">{item.colorLabel}</span>
                            )}
                            {item.sizeLabel && (
                              <span className="text-[11px] font-semibold bg-brand-100 text-brand-600 px-1.5 py-0.5 rounded-full">{item.sizeLabel}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <button type="button"
                        onClick={() => removeItem(item.productId, variantOf(item))}
                        className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                        aria-label="Retirer">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="inline-flex items-center border border-gray-200 rounded-full bg-white">
                        <button type="button"
                          onClick={() => updateQty(item.productId, item.quantity - 1, variantOf(item))}
                          disabled={item.quantity <= 1}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors rounded-full">
                          <Minus size={12} />
                        </button>
                        <span className="w-7 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                        <button type="button"
                          onClick={() => updateQty(item.productId, item.quantity + 1, variantOf(item))}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors rounded-full">
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="font-bold text-brand-600 text-sm">
                        {(item.price * item.quantity).toFixed(3)} TND
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-4 sm:px-5 pt-3 pb-4 space-y-2.5 flex-shrink-0"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Sous-total</span>
              <span className="font-bold text-gray-900">{total.toFixed(3)} TND</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Livraison</span>
              <span className={`font-bold ${shipping === 0 ? "text-sage-600" : "text-gray-900"}`}>
                {shipping === 0 ? "Gratuite !" : `${shipping.toFixed(3)} TND`}
              </span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2.5">
              <span>Total</span>
              <span className="text-brand-600">{(total + shipping).toFixed(3)} TND</span>
            </div>

            <Link to="/checkout" onClick={closeCart} className="btn-primary w-full justify-center py-3.5 text-base mt-1">
              Commander <ArrowRight size={17} />
            </Link>
            <Link to="/panier" onClick={closeCart}
              className="block text-center text-sm font-semibold text-gray-400 hover:text-brand-600 transition-colors py-1">
              Voir le panier complet
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
