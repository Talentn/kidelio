import { useEffect, useRef, useState } from 'react'
import { ShoppingBag, X } from 'lucide-react'

export type CartToastData = {
  id: number
  productName: string
  imageUrl?: string
}

interface Props {
  toast: CartToastData
  onDismiss: (id: number) => void
  duration?: number
}

export function CartToast({ toast, onDismiss, duration = 3000 }: Props) {
  const [progress, setProgress] = useState(100)
  const [visible, setVisible]   = useState(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  // Slide in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  // Shrink the bar
  useEffect(() => {
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts
      const elapsed = ts - startRef.current
      const pct = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(pct)
      if (pct > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setVisible(false)
        setTimeout(() => onDismiss(toast.id), 300)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [toast.id, duration, onDismiss])

  return (
    <div
      className={`relative flex items-center gap-3 bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 w-72 overflow-hidden transition-all duration-300
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
    >
      {/* Product thumbnail or icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
        {toast.imageUrl ? (
          <img src={toast.imageUrl} alt={toast.productName} className="w-full h-full object-cover" />
        ) : (
          <ShoppingBag size={18} className="text-brand-500" />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-green-600 mb-0.5">Ajouté au panier ✓</p>
        <p className="text-sm font-semibold text-gray-800 truncate">{toast.productName}</p>
      </div>

      {/* Close */}
      <button
        onClick={() => { setVisible(false); setTimeout(() => onDismiss(toast.id), 300) }}
        className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
      >
        <X size={14} />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gray-100">
        <div
          className="h-full bg-brand-500 transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
