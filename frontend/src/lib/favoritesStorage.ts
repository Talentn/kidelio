/** Guest favorites — product IDs stored in a browser cookie (no login required). */

export const FAVORITES_COOKIE = 'kidelio_favs'
const MAX_FAVORITES = 50

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function writeCookie(name: string, value: string) {
  const expires = new Date(Date.now() + 365 * 864e5).toUTCString()
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`
}

function parseIds(raw: string | null): number[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is number => typeof id === 'number' && id > 0)
  } catch {
    return []
  }
}

export function readFavoriteIds(): number[] {
  const fromCookie = parseIds(readCookie(FAVORITES_COOKIE))
  if (fromCookie.length > 0) return fromCookie.slice(0, MAX_FAVORITES)

  try {
    return parseIds(localStorage.getItem(FAVORITES_COOKIE)).slice(0, MAX_FAVORITES)
  } catch {
    return []
  }
}

export function writeFavoriteIds(ids: number[]): number[] {
  const unique = [...new Set(ids)].slice(0, MAX_FAVORITES)
  const json = JSON.stringify(unique)
  writeCookie(FAVORITES_COOKIE, json)
  try {
    localStorage.setItem(FAVORITES_COOKIE, json)
  } catch { /* private browsing */ }
  return unique
}
