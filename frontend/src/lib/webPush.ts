/**
 * Web Push (VAPID) subscription helpers for the admin back office.
 * The service worker lives at /sw.js; subscriptions are stored server-side
 * with per-event preferences (orders / chat / contact messages).
 */
import { apiAdmin } from './api'

export type PushPrefs = {
  notify_orders: boolean
  notify_chat: boolean
  notify_messages: boolean
}

export type PushStatus = {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
  prefs: PushPrefs | null
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  return reg
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

/** Current device state: browser support, permission, server-side prefs. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) {
    return { supported: false, permission: 'unsupported', subscribed: false, prefs: null }
  }
  const permission = Notification.permission
  const sub = await currentSubscription()
  if (!sub) return { supported: true, permission, subscribed: false, prefs: null }

  try {
    const res = await apiAdmin<{ subscribed: boolean; prefs?: PushPrefs }>('/push/status', {
      method: 'POST',
      body: JSON.stringify({ endpoint: sub.endpoint }),
    })
    return { supported: true, permission, subscribed: res.subscribed, prefs: res.prefs ?? null }
  } catch {
    return { supported: true, permission, subscribed: false, prefs: null }
  }
}

/** Ask permission, subscribe this device and register it server-side. */
export async function enablePush(): Promise<PushPrefs> {
  if (!isPushSupported()) {
    throw new Error('Les notifications push ne sont pas supportées par ce navigateur')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Permission refusée — autorisez les notifications dans les réglages du navigateur')
  }

  const reg = await getRegistration()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const { public_key } = await apiAdmin<{ public_key: string }>('/push/config')
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource,
    })
  }

  const json = sub.toJSON()
  const res = await apiAdmin<{ ok: boolean; prefs: PushPrefs }>('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    }),
  })
  return res.prefs
}

/** Remove this device server-side and drop the browser subscription. */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  await apiAdmin('/push/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {})
  await sub.unsubscribe().catch(() => {})
}

/** Update per-event preferences for this device. */
export async function updatePushPrefs(prefs: Partial<PushPrefs>): Promise<PushPrefs> {
  const sub = await currentSubscription()
  if (!sub) throw new Error("Cet appareil n'est pas abonné aux notifications")
  const res = await apiAdmin<{ ok: boolean; prefs: PushPrefs }>('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint: sub.endpoint, ...prefs }),
  })
  return res.prefs
}

/** Ask the server to send a test notification to this device. */
export async function sendTestPush(): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) throw new Error("Cet appareil n'est pas abonné aux notifications")
  await apiAdmin('/push/test', {
    method: 'POST',
    body: JSON.stringify({ endpoint: sub.endpoint }),
  })
}
