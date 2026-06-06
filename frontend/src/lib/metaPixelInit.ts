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

// Shared pixel state — same module instance across the app via ES module cache.
export let _pixelReady = false

let lastPageViewKey = ''
let lastPageViewAt = 0
const PAGE_VIEW_DEDUP_MS = 4000

function pixelId(): string {
  return (import.meta.env.VITE_META_PIXEL_ID ?? '').trim()
}

export function isMetaPixelConfigured(): boolean {
  return pixelId().length > 0
}

export function isPixelReady(): boolean {
  return _pixelReady
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

export function activatePixel(): void {
  if (_pixelReady || !isMetaPixelConfigured()) return
  injectScript()
  window.fbq?.('init', pixelId())
  _pixelReady = true
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

/** Fire PageView once per path within a short window (avoids duplicate SPA + consent fires). */
export function trackPageView(path?: string): void {
  if (!_pixelReady) return
  const pagePath = path ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
  const key = `${pagePath}${typeof window !== 'undefined' ? window.location.search : ''}`
  const now = Date.now()
  if (key === lastPageViewKey && now - lastPageViewAt < PAGE_VIEW_DEDUP_MS) return
  lastPageViewKey = key
  lastPageViewAt = now
  window.fbq?.('track', 'PageView')
}
