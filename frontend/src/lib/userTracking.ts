import { goTrack, goTrackBeacon, liveSessionId } from './goApi'

export type UserEventType =
  | 'page_view'
  | 'page_leave'
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

/** Human-readable duration for admin display. */
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

/** Fire-and-forget user activity event for admin live tracking. */
export function trackUserActivity(payload: TrackPayload, opts?: { beacon?: boolean }) {
  const key = `${payload.event_type}:${payload.path ?? ''}:${payload.product_id ?? ''}:${JSON.stringify(payload.metadata ?? {})}`
  if (payload.event_type !== 'page_leave' && !shouldTrack(key)) return

  const body = {
    session_id: liveSessionId(),
    event_type: payload.event_type,
    path: payload.path,
    product_id: payload.product_id,
    product_name: payload.product_name,
    metadata: payload.metadata,
  }

  if (opts?.beacon) {
    goTrackBeacon('/tracking/events', body)
  } else {
    goTrack('/tracking/events', body)
  }
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
