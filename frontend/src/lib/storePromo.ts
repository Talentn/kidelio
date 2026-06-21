export type StorePromoOffer = {
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  max_discount?: number | null
  min_order_amount?: number | null
  once_per_customer: boolean
}

export type StorePromoResponse = {
  promo: StorePromoOffer
  eligible: boolean
  first_time_unknown: boolean
}

export type StorePromoIdentity = {
  guest_name?: string
  guest_phone?: string
  shipping_governorate?: string
  shipping_delegation?: string
  shipping_address?: string
}

/** Mirrors PromoCode#apply_to for a single amount (product unit price or cart subtotal). */
export function applyPromoDiscount(amount: number, promo: StorePromoOffer): number {
  const subtotal = Math.max(0, Number(amount) || 0)
  if (subtotal <= 0) return 0

  let discount =
    promo.discount_type === 'percentage'
      ? subtotal * (Number(promo.discount_value) / 100)
      : Number(promo.discount_value)

  if (promo.max_discount != null && promo.discount_type === 'percentage') {
    discount = Math.min(discount, Number(promo.max_discount))
  }

  return Math.min(Math.max(discount, 0), subtotal)
}

export function priceAfterPromo(amount: number, promo: StorePromoOffer): number {
  return Math.max(0, amount - applyPromoDiscount(amount, promo))
}

export function buildStoreOfferQuery(identity?: StorePromoIdentity): string {
  if (!identity) return ''
  const params = new URLSearchParams()
  if (identity.guest_name?.trim()) params.set('guest_name', identity.guest_name.trim())
  if (identity.guest_phone?.trim()) params.set('guest_phone', identity.guest_phone.trim())
  if (identity.shipping_governorate?.trim()) {
    params.set('shipping_governorate', identity.shipping_governorate.trim())
  }
  if (identity.shipping_delegation?.trim()) {
    params.set('shipping_delegation', identity.shipping_delegation.trim())
  }
  if (identity.shipping_address?.trim()) params.set('shipping_address', identity.shipping_address.trim())
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function shouldShowProductPromoPrice(
  eligible: boolean,
  firstTimeUnknown: boolean,
): boolean {
  return eligible || firstTimeUnknown
}

export function promoDiscountLabel(promo: StorePromoOffer): string {
  if (promo.discount_type === 'percentage') {
    const value = Number(promo.discount_value)
    const pct = value % 1 === 0 ? value.toFixed(0) : value.toString()
    return `${pct}%`
  }
  return `${Number(promo.discount_value).toFixed(3)} TND`
}
