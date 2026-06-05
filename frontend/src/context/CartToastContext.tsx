import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CartToast, type CartToastData } from '../components/CartToast'

type ShowToast = (productName: string, imageUrl?: string) => void

const CartToastContext = createContext<ShowToast>(() => {})

export function useCartToast() {
  return useContext(CartToastContext)
}

export function CartToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<CartToastData[]>([])
  const counterRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const show: ShowToast = useCallback((productName, imageUrl) => {
    const id = ++counterRef.current
    setToasts(prev => [...prev.slice(-2), { id, productName, imageUrl }])
  }, [])

  return (
    <CartToastContext.Provider value={show}>
      {children}
      {/* Toast stack — top-right */}
      <div className="fixed top-4 right-4 z-[500] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <CartToast toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </CartToastContext.Provider>
  )
}
