/**
 * Meta Pixel — bootstrap only.
 * Imported by eager components (MetaPixel, CookieConsent).
 * Event-tracking functions live in metaPixel.ts (lazy chunks only).
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

type PendingEvent = {
  kind: 'track' | 'trackCustom'
  event: string
  params?: Record<string, unknown>
  options?: Record<string, unknown>
}

// Shared pixel state — same module instance across the app via ES module cache.
export let _pixelReady = false

export const CONSENT_STORAGE_KEY = 'kidelio_consent'

let runtimePixelId = ''
let pendingEvents: PendingEvent[] = []
let lastPageViewKey = ''
let lastPageViewAt = 0
const PAGE_VIEW_DEDUP_MS = 4000

function buildTimePixelId(): string {
  return (import.meta.env.VITE_META_PIXEL_ID ?? '').trim()
}

function pixelId(): string {
  return runtimePixelId || buildTimePixelId()
}

/** Runtime fallback when VITE_META_PIXEL_ID was not baked into the build. */
export function setMetaPixelId(id: string): void {
  const next = id.trim()
  if (!next || next === runtimePixelId) return
  runtimePixelId = next
  if (hasMarketingConsent() && !_pixelReady) {
    activatePixel()
    injectNoscript()
  }
}

export function isMetaPixelConfigured(): boolean {
  return pixelId().length > 0
}

export function isPixelReady(): boolean {
  return _pixelReady
}

export function hasMarketingConsent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) === 'all'
  } catch {
    return false
  }
}

export function rememberConsent(level: 'all' | 'essential'): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, level)
  } catch {
    /* private browsing */
  }
}

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

const PIXEL_READY_EVENT = 'kidelio-pixel-ready'

function flushPendingEvents(): void {
  if (!_pixelReady || pendingEvents.length === 0) return
  const queued = pendingEvents
  pendingEvents = []
  for (const item of queued) {
    if (item.kind === 'trackCustom') {
      window.fbq?.('trackCustom', item.event, item.params)
    } else if (item.options) {
      window.fbq?.('track', item.event, item.params, item.options)
    } else if (item.params) {
      window.fbq?.('track', item.event, item.params)
    } else {
      window.fbq?.('track', item.event)
    }
  }
}

export function activatePixel(): void {
  if (_pixelReady || !isMetaPixelConfigured()) return
  injectScript()
  window.fbq?.('init', pixelId())
  _pixelReady = true
  flushPendingEvents()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PIXEL_READY_EVENT))
  }
}

export function onPixelReady(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  if (_pixelReady) handler()
  const listener = () => handler()
  window.addEventListener(PIXEL_READY_EVENT, listener)
  return () => window.removeEventListener(PIXEL_READY_EVENT, listener)
}

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

/** Queue until consent activates the pixel — never drop events silently. */
export function sendPixelEvent(
  kind: PendingEvent['kind'],
  event: string,
  params?: Record<string, unknown>,
  options?: Record<string, unknown>,
): void {
  const mayQueue = isMetaPixelConfigured() || hasMarketingConsent()
  if (!mayQueue) return

  if (!_pixelReady || !isMetaPixelConfigured()) {
    pendingEvents.push({ kind, event, params, options })
    return
  }

  if (kind === 'trackCustom') {
    window.fbq?.('trackCustom', event, params)
  } else if (options) {
    window.fbq?.('track', event, params, options)
  } else if (params) {
    window.fbq?.('track', event, params)
  } else {
    window.fbq?.('track', event)
  }
}

/** Fire PageView once per path within a short window (avoids duplicate SPA + consent fires). */
export function trackPageView(path?: string): void {
  if (!isMetaPixelConfigured()) return
  const pagePath = path ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
  const key = `${pagePath}${typeof window !== 'undefined' ? window.location.search : ''}`
  const now = Date.now()
  if (key === lastPageViewKey && now - lastPageViewAt < PAGE_VIEW_DEDUP_MS) return
  lastPageViewKey = key
  lastPageViewAt = now
  sendPixelEvent('track', 'PageView')
}
