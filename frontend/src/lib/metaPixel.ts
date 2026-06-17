/**
 * Meta Pixel — event tracking functions.
 * Only imported by lazy page components (Products, ProductDetail, Checkout, etc.)
 * so this module never lands in the initial JS bundle.
 *
 * Bootstrap/init functions live in metaPixelInit.ts.
 */

import { defaultCatalogContentId, metaCatalogContentId } from './metaCatalogId'
import { isMetaPixelConfigured, sendPixelEvent } from './metaPixelInit'

// Re-export init helpers so existing page-component imports keep working.
export {
  isMetaPixelConfigured,
  isPixelReady,
  activatePixel,
  injectNoscript,
  trackPageView,
  setMetaPixelId,
  rememberConsent,
  hasMarketingConsent,
  onPixelReady,
} from './metaPixelInit'

// ─── low-level wrappers ──────────────────────────────────────────────────────

function fbq(event: string, params?: Record<string, unknown>): void {
  sendPixelEvent('track', event, params)
}

function fbqCustom(event: string, params?: Record<string, unknown>): void {
  sendPixelEvent('trackCustom', event, params)
}

// ─── page / session ──────────────────────────────────────────────────────────

export function trackSearch(query: string, results: number): void {
  fbq('Search', {
    search_string: query,
    content_category: 'product',
    num_items: results,
    currency: 'TND',
  })
}

export function trackViewCategory(category: { id: number; name: string }): void {
  fbq('ViewContent', {
    content_ids: [`cat_${category.id}`],
    content_name: category.name,
    content_type: 'product_group',
    currency: 'TND',
  })
}

// ─── product detail ──────────────────────────────────────────────────────────

export function trackViewContent(product: {
  id: number
  name: string
  price: number
  effective_price: number
  on_promo?: boolean
  in_stock?: boolean
  category?: string
  age_group?: string
  colorId?: number | null
  sizeLabel?: string | null
  colors?: Array<{ id: number; position?: number; sizes?: Array<{ size: string }> }>
}): void {
  const contentId = product.colorId
    ? metaCatalogContentId(product.id, product.colorId, product.sizeLabel)
    : defaultCatalogContentId(product)

  const price = Number(product.effective_price ?? product.price ?? 0)
  const basePrice = Number(product.price ?? price)

  fbq('ViewContent', {
    content_ids: [contentId],
    content_name: product.name,
    content_type: 'product',
    content_category: product.category ?? '',
    value: Number(price.toFixed(3)),
    currency: 'TND',
  })

  fbqCustom('ProductView', {
    content_ids: [contentId],
    content_name: product.name,
    content_category: product.category ?? '',
    age_group: product.age_group ?? '',
    price: Number(basePrice.toFixed(3)),
    sale_price: product.on_promo ? Number(price.toFixed(3)) : undefined,
    on_promo: product.on_promo ?? false,
    in_stock: product.in_stock ?? true,
    currency: 'TND',
  })

  if (product.on_promo) {
    fbqCustom('ViewPromotion', {
      content_ids: [contentId],
      content_name: product.name,
      original_price: Number(basePrice.toFixed(3)),
      sale_price: Number(price.toFixed(3)),
      savings: Number((basePrice - price).toFixed(3)),
      currency: 'TND',
    })
  }

  if (product.in_stock === false) {
    fbqCustom('OutOfStockView', {
      content_ids: [contentId],
      content_name: product.name,
      content_category: product.category ?? '',
      currency: 'TND',
    })
  }
}

// ─── cart ────────────────────────────────────────────────────────────────────

export function trackAddToCart(item: {
  productId: number
  name: string
  price: number
  quantity: number
  category?: string
  on_promo?: boolean
  colorId?: number | null
  sizeLabel?: string | null
}): void {
  fbq('AddToCart', {
    content_ids: [metaCatalogContentId(item.productId, item.colorId, item.sizeLabel)],
    content_name: item.name,
    content_type: 'product',
    content_category: item.category ?? '',
    value: Number((item.price * item.quantity).toFixed(3)),
    currency: 'TND',
    num_items: item.quantity,
  })
}

// ─── checkout ────────────────────────────────────────────────────────────────

export function trackInitiateCheckout(payload: {
  value: number
  numItems: number
  contentIds: string[]
}): void {
  fbq('InitiateCheckout', {
    value: Number(payload.value.toFixed(3)),
    currency: 'TND',
    content_ids: payload.contentIds,
    content_type: 'product',
    num_items: payload.numItems,
  })
}

export function trackPromoCodeApplied(payload: {
  code: string
  discount: number
  subtotal: number
}): void {
  fbqCustom('PromoCodeApplied', {
    promo_code: payload.code,
    discount_amount: Number(payload.discount.toFixed(3)),
    subtotal: Number(payload.subtotal.toFixed(3)),
    currency: 'TND',
  })
}

export function trackPurchase(payload: {
  value: number
  orderNumber: string
  numItems: number
  contentIds: string[]
  promoCode?: string
  discount?: number
  utms?: Record<string, string>
}): void {
  if (!isMetaPixelConfigured()) return
  sendPixelEvent(
    'track',
    'Purchase',
    {
      value: Number(payload.value.toFixed(3)),
      currency: 'TND',
      content_ids: payload.contentIds,
      content_type: 'product',
      num_items: payload.numItems,
      order_id: payload.orderNumber,
      ...(payload.promoCode ? { coupon: payload.promoCode } : {}),
      ...(payload.utms && Object.keys(payload.utms).length > 0
        ? { custom_data: payload.utms }
        : {}),
    },
    { eventID: payload.orderNumber },
  )
}

// ─── account / lead ──────────────────────────────────────────────────────────

export function trackCompleteRegistration(method: 'email' | 'google' = 'email'): void {
  fbq('CompleteRegistration', {
    content_name: 'Account Creation',
    currency: 'TND',
    status: true,
    registration_method: method,
  })
}

export function trackContact(): void {
  fbq('Contact')
}
