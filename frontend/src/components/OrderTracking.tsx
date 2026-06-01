import { Check, Circle, Package, Truck } from 'lucide-react'
import { ORDER_STATUS_STYLES, orderStatusLabel } from '../lib/orderStatus'

export type OrderTimelineStep = {
  status: string
  label: string
  done: boolean
  active: boolean
}

export type TrackedOrder = {
  order_number: string
  status: string
  status_label: string
  created_at: string
  total: number
  items_count?: number
  timeline: OrderTimelineStep[]
  shipping?: {
    governorate?: string
    delegation?: string
    address?: string
    postal_code?: string
  }
  subtotal?: number
  shipping_cost?: number
  discount_amount?: number
  payment_method?: string
  items?: Array<{
    product_name: string
    quantity: number
    unit_price: number
    size_label?: string
    color_label?: string
  }>
}

const STATUS_COLORS = ORDER_STATUS_STYLES

export function OrderTracking({ order, detailed = false }: { order: TrackedOrder; detailed?: boolean }) {
  const cancelled = order.status === 'cancelled' || order.status === 'refunded'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Numéro de suivi</p>
          <p className="font-bold text-xl text-ink tracking-wide">{order.order_number}</p>
          <p className="text-sm text-gray-500 mt-1">
            Commande du{' '}
            {new Date(order.created_at).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
          {order.status_label || orderStatusLabel(order.status)}
        </span>
      </div>

      {!cancelled && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 md:p-6">
          <h3 className="font-display font-semibold text-ink mb-5 flex items-center gap-2">
            <Truck size={18} className="text-brand-500" />
            Suivi de livraison
          </h3>
          <ol className="space-y-0">
            {order.timeline.map((step, idx) => {
              const isLast = idx === order.timeline.length - 1
              return (
                <li key={step.status} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        step.done
                          ? 'bg-brand-500 text-white'
                          : step.active
                            ? 'bg-brand-100 text-brand-600 ring-2 ring-brand-300'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {step.done ? <Check size={16} strokeWidth={3} /> : <Circle size={14} />}
                    </span>
                    {!isLast && (
                      <div className={`w-0.5 flex-1 min-h-[2rem] ${step.done ? 'bg-brand-300' : 'bg-gray-200'}`} />
                    )}
                  </div>
                  <div className={`pb-6 ${isLast ? 'pb-0' : ''}`}>
                    <p className={`font-semibold text-sm ${step.active || step.done ? 'text-gray-900' : 'text-gray-400'}`}>
                      {step.label}
                    </p>
                    {step.active && (
                      <p className="text-xs text-brand-600 font-medium mt-0.5">Étape en cours</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {cancelled && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-700 font-medium">
          Cette commande a été {order.status === 'refunded' ? 'remboursée' : 'annulée'}.
        </div>
      )}

      {order.shipping?.governorate && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-2">Adresse de livraison</h3>
          <p className="text-gray-600 text-sm">
            {order.shipping.delegation}, {order.shipping.governorate}
            {detailed && order.shipping.address && (
              <>
                <br />
                {order.shipping.address}
              </>
            )}
          </p>
        </div>
      )}

      {detailed && order.items && order.items.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Package size={18} className="text-brand-500" />
            <h3 className="font-semibold text-gray-900 text-sm">Articles ({order.items_count})</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {order.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.product_name}</p>
                  {(item.size_label || item.color_label) && (
                    <p className="text-xs text-gray-400">
                      {[item.color_label, item.size_label].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">×{item.quantity}</p>
                </div>
                <span className="font-bold text-gray-900 flex-shrink-0">
                  {(Number(item.unit_price) * item.quantity).toFixed(3)} TND
                </span>
              </li>
            ))}
          </ul>
          <div className="px-5 py-4 border-t border-gray-100 space-y-1 text-sm">
            {order.subtotal != null && (
              <div className="flex justify-between text-gray-600">
                <span>Sous-total</span>
                <span>{Number(order.subtotal).toFixed(3)} TND</span>
              </div>
            )}
            {order.discount_amount != null && Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Réduction</span>
                <span>-{Number(order.discount_amount).toFixed(3)} TND</span>
              </div>
            )}
            {order.shipping_cost != null && (
              <div className="flex justify-between text-gray-600">
                <span>Livraison</span>
                <span>
                  {Number(order.shipping_cost) === 0
                    ? 'Gratuite'
                    : `${Number(order.shipping_cost).toFixed(3)} TND`}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1">
              <span>Total</span>
              <span className="text-brand-600">{Number(order.total).toFixed(3)} TND</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
