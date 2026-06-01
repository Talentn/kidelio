/**
 * Meta Pixel — zero API calls in event trackers.
 *
 * Consent is hydrated ONCE by <MetaPixel /> on app mount.
 * After that all tracking is synchronous — no async, no network overhead.
 */

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

type Fbq = {
  (...args: unknown[]): void
  callMethod?: (...args: unknown[]) => void
  queue: unknown[]
  loaded?: boolean
  version?: string
  push: Fbq
}

// ─── module-level state (reset on HMR in dev) ───────────────────────────────
let _pixelReady = false

function pixelId(): string {
  return (import.meta.env.VITE_META_PIXEL_ID ?? '').trim()
}

export function isMetaPixelConfigured(): boolean {
  return pixelId().length > 0
}

export function isPixelReady(): boolean {
  return _pixelReady
}

// ─── bootstrap ──────────────────────────────────────────────────────────────
function injectFbqStub(): void {
  if (window.fbq) return

  const n: Fbq = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args)
    else n.queue.push(args)
  } as Fbq
  if (!window._fbq) window._fbq = n
  n.push = n
  n.loaded = true
  n.version = '2.0'
  n.queue = []
  window.fbq = n
}

function injectScript(): void {
  if (document.getElementById('meta-pixel-sdk')) return
  injectFbqStub()
  const s = document.createElement('script')
  s.id = 'meta-pixel-sdk'
  s.async = true
  s.src = 'https://connect.facebook.net/en_US/fbevents.js'
  const first = document.getElementsByTagName('script')[0]
  first.parentNode?.insertBefore(s, first)
}

/**
 * Called by <MetaPixel /> once consent is known.
 * Also called immediately when the user clicks "Tout accepter".
 */
export function activatePixel(): void {
  if (_pixelReady || !isMetaPixelConfigured()) return
  injectScript()
  window.fbq?.('init', pixelId())
  _pixelReady = true
}

/** Inject <noscript> img tag for browsers with JS disabled. */
export function injectNoscript(): void {
  const id = pixelId()
  if (!id || document.getElementById('meta-pixel-noscript')) return
  const ns = document.createElement('noscript')
  ns.id = 'meta-pixel-noscript'
  const img = document.createElement('img')
  img.height = 1
  img.width = 1
  img.style.display = 'none'
  img.src = `https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`
  ns.appendChild(img)
  document.body.appendChild(ns)
}

// ─── low-level wrappers ──────────────────────────────────────────────────────

/** Standard pixel event (visible in Events Manager as "Standard Events"). */
function fbq(event: string, params?: Record<string, unknown>): void {
  if (!_pixelReady) return
  if (params) window.fbq?.('track', event, params)
  else window.fbq?.('track', event)
}

/** Custom pixel event (visible in Events Manager under "Custom Events"). */
function fbqCustom(event: string, params?: Record<string, unknown>): void {
  if (!_pixelReady) return
  if (params) window.fbq?.('trackCustom', event, params)
  else window.fbq?.('trackCustom', event)
}

// ─── page / session ──────────────────────────────────────────────────────────

export function trackPageView(): void {
  fbq('PageView')
}

// ─── search & browsing ───────────────────────────────────────────────────────

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
  price: number           // original price
  effective_price: number // sale price if on promo
  on_promo?: boolean
  in_stock?: boolean
  category?: string
  age_group?: string
}): void {
  fbq('ViewContent', {
    content_ids: [String(product.id)],
    content_name: product.name,
    content_type: 'product',
    content_category: product.category ?? '',
    value: Number(product.effective_price.toFixed(3)),
    currency: 'TND',
  })

  // Custom event — richer data for ad optimisation
  fbqCustom('ProductView', {
    content_ids: [String(product.id)],
    content_name: product.name,
    content_category: product.category ?? '',
    age_group: product.age_group ?? '',
    price: Number(product.price.toFixed(3)),
    sale_price: product.on_promo
      ? Number(product.effective_price.toFixed(3))
      : undefined,
    on_promo: product.on_promo ?? false,
    in_stock: product.in_stock ?? true,
    currency: 'TND',
  })

  // Dedicated promo-view event — for retargeting audiences of discount shoppers
  if (product.on_promo) {
    fbqCustom('ViewPromotion', {
      content_ids: [String(product.id)],
      content_name: product.name,
      original_price: Number(product.price.toFixed(3)),
      sale_price: Number(product.effective_price.toFixed(3)),
      savings: Number((product.price - product.effective_price).toFixed(3)),
      currency: 'TND',
    })
  }

  // Out-of-stock view — for "back-in-stock" retargeting audiences
  if (product.in_stock === false) {
    fbqCustom('OutOfStockView', {
      content_ids: [String(product.id)],
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
}): void {
  fbq('AddToCart', {
    content_ids: [String(item.productId)],
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

/**
 * Fired when the user successfully applies a promo code.
 * Lets you build audiences of "discount-sensitive" users in Meta.
 */
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
  // event_id = orderNumber so Meta deduplicates with the server-side Purchase
  // sent by MetaConversionsApi (same event_id on both sides = counted once)
  if (!_pixelReady) return
  window.fbq?.('track', 'Purchase', {
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
  }, { eventID: payload.orderNumber })
}

// ─── account / lead ──────────────────────────────────────────────────────────

/** Fired after a new account is created (Registration page). */
export function trackCompleteRegistration(method: 'email' | 'google' = 'email'): void {
  fbq('CompleteRegistration', {
    content_name: 'Account Creation',
    currency: 'TND',
    status: true,
    registration_method: method,
  })
}

/** Fired after the user submits the Contact form. */
export function trackContact(): void {
  fbq('Contact')
}
