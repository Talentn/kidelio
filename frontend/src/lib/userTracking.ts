import { apiV1 } from './api'
import { liveSessionId } from './goApi'

export type UserEventType =
  | 'page_view'
  | 'page_leave'
  | 'product_view'
  | 'search'
  | 'checkout_start'
  | 'favorite_add'
  | 'favorite_remove'

type TrackPayload = {
  event_type: UserEventType
  path?: string
  product_id?: number
  product_name?: string
  metadata?: Record<string, unknown>
}

const DEDUP_MS = 3_000
const recent = new Map<string, number>()

function shouldTrack(key: string): boolean {
  const now = Date.now()
  const last = recent.get(key)
  if (last != null && now - last < DEDUP_MS) return false
  recent.set(key, now)
  return true
}

export function formatDurationMs(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return rem ? `${m} min ${rem}s` : `${m} min`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm ? `${h}h ${rm} min` : `${h}h`
}

function postActivity(body: Record<string, unknown>, beacon = false) {
  const payload = JSON.stringify({ session_id: liveSessionId(), ...body })
  const headers = {
    'Content-Type': 'application/json',
    'X-Session-Id': liveSessionId(),
  }

  if (beacon) {
    if (typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon('/api/v1/activity/signals', new Blob([payload], { type: 'application/json' }))
      if (ok) return
    }
    fetch('/api/v1/activity/signals', {
      method: 'POST',
      headers,
      body: payload,
      credentials: 'include',
      keepalive: true,
    }).catch(() => {})
    return
  }

  apiV1('/activity/signals', { method: 'POST', body: payload }).catch(() => {})
}

export function trackUserActivity(payload: TrackPayload, opts?: { beacon?: boolean }) {
  const key = `${payload.event_type}:${payload.path ?? ''}:${payload.product_id ?? ''}`
  if (payload.event_type !== 'page_leave' && !shouldTrack(key)) return
  postActivity(payload, opts?.beacon)
}

export function trackPageView(pathname: string) {
  if (pathname.startsWith('/admin')) return
  trackUserActivity({ event_type: 'page_view', path: pathname })
}

export function trackPageLeave(
  pathname: string,
  durationMs: number,
  reason: 'navigation' | 'close' | 'background',
  useBeacon = false,
) {
  if (pathname.startsWith('/admin')) return
  trackUserActivity(
    {
      event_type: 'page_leave',
      path: pathname,
      metadata: {
        duration_ms: durationMs,
        duration_sec: Math.round(durationMs / 1000),
        reason,
      },
    },
    { beacon: useBeacon },
  )
}

export function trackProductView(productId: number, productName: string, slug: string) {
  trackUserActivity({
    event_type: 'product_view',
    path: `/produits/${slug}`,
    product_id: productId,
    product_name: productName,
  })
}

export function trackSearchQuery(query: string, resultCount: number) {
  trackUserActivity({
    event_type: 'search',
    path: '/produits',
    metadata: { query, result_count: resultCount },
  })
}

export function trackCheckoutStart(itemCount: number, total: number) {
  trackUserActivity({
    event_type: 'checkout_start',
    path: '/checkout',
    metadata: { item_count: itemCount, total },
  })
}

export function trackFavorite(action: 'add' | 'remove', productId: number, productName: string) {
  trackUserActivity({
    event_type: action === 'add' ? 'favorite_add' : 'favorite_remove',
    product_id: productId,
    product_name: productName,
  })
}
