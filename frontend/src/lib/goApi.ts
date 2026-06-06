// Go service — REST + WS under /api/v1/* (explicit Rails routes; avoid /realtime, /live, /go)
const GO_BASE = '/api/v1'

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
