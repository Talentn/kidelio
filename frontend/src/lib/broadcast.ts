/**
 * Cross-tab / multi-window synchronization.
 *
 * Uses BroadcastChannel when available (modern browsers), and always also
 * writes a timestamped key to localStorage so the `storage` event fires in
 * other tabs as a universal fallback. Listeners receive a typed message.
 */

export type SyncEvent =
  | { type: 'auth'; action: 'login' | 'logout' | 'refresh' }
  | { type: 'cart'; action: 'changed' }

const CHANNEL_NAME = 'kids-shop-sync'
const STORAGE_KEY = 'kids-shop-sync-event'

const channel: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(CHANNEL_NAME)
    : null

/** Broadcast an event to every other tab/window. */
export function broadcast(event: SyncEvent) {
  try {
    channel?.postMessage(event)
  } catch {
    /* ignore */
  }
  // localStorage fallback — the `storage` event only fires in OTHER tabs.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...event, t: Date.now() }))
  } catch {
    /* ignore */
  }
}

/** Subscribe to cross-tab events. Returns an unsubscribe function. */
export function onBroadcast(handler: (event: SyncEvent) => void): () => void {
  const onMessage = (e: MessageEvent) => handler(e.data as SyncEvent)
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return
    try {
      const parsed = JSON.parse(e.newValue) as SyncEvent
      handler(parsed)
    } catch {
      /* ignore */
    }
  }

  channel?.addEventListener('message', onMessage)
  window.addEventListener('storage', onStorage)

  return () => {
    channel?.removeEventListener('message', onMessage)
    window.removeEventListener('storage', onStorage)
  }
}
