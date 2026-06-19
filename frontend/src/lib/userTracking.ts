import { goTrack, liveSessionId } from './goApi'

export type UserEventType =
  | 'page_view'
  | 'product_view'
  | 'search'
  | 'checkout_start'

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
  if (recent.size > 200) {
    for (const [k, t] of recent) {
      if (now - t > DEDUP_MS * 2) recent.delete(k)
    }
  }
  return true
}

/** Fire-and-forget user activity event for admin live tracking. */
export function trackUserActivity(payload: TrackPayload) {
  const key = `${payload.event_type}:${payload.path ?? ''}:${payload.product_id ?? ''}:${JSON.stringify(payload.metadata ?? {})}`
  if (!shouldTrack(key)) return

  goTrack('/tracking/events', {
    session_id: liveSessionId(),
    event_type: payload.event_type,
    path: payload.path,
    product_id: payload.product_id,
    product_name: payload.product_name,
    metadata: payload.metadata,
  })
}

export function trackPageView(pathname: string) {
  if (pathname.startsWith('/admin')) return
  trackUserActivity({ event_type: 'page_view', path: pathname })
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
