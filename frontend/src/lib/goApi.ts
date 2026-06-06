// Go service — REST + WS under /api/v1/* (explicit Rails routes; avoid /realtime, /live, /go)
const GO_BASE = '/api/v1'

/** WebSocket needs nginx → Go directly; off in production until VITE_ENABLE_CHAT_WS=true */
export function goWsEnabled(): boolean {
  const flag = import.meta.env.VITE_ENABLE_CHAT_WS
  if (flag === 'true') return true
  if (flag === 'false') return false
  return import.meta.env.DEV
}

export function goUrl(path: string) {
  return `${GO_BASE}${path}`
}

export function goWsUrl(path: string) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/api/v1${path}`
}

export async function goPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(goUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function goGet<T>(path: string): Promise<T> {
  const res = await fetch(goUrl(path), { credentials: 'include' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
