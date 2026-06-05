// Go service — proxied via Vite (/go) in dev and nginx (/go) in production
const GO_BASE = '/go'

export function goUrl(path: string) {
  return `${GO_BASE}${path}`
}

export function goWsUrl(path: string) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/go${path}`
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
