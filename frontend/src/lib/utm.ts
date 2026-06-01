/**
 * UTM + fbclid capture.
 *
 * On first landing from an ad the URL contains utm_* params and/or fbclid.
 * We persist them in sessionStorage so they survive client-side navigation
 * and are included in the Purchase event for attribution.
 */

const STORAGE_KEY = 'kidelio_utms'
const AD_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',   // Meta click ID — also used by the pixel automatically
  'adset',
  'ad',
] as const

export type UtmData = Partial<Record<(typeof AD_PARAMS)[number], string>>

/** Call once on app mount (inside MetaPixel). */
export function captureUtms(): void {
  const params = new URLSearchParams(window.location.search)
  const found: UtmData = {}
  for (const key of AD_PARAMS) {
    const val = params.get(key)
    if (val) found[key] = val
  }
  if (Object.keys(found).length > 0) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found))
    } catch {
      // private browsing may block sessionStorage — ignore
    }
  }
}

/** Returns UTMs captured earlier in the session (empty object if none). */
export function getStoredUtms(): UtmData {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as UtmData) : {}
  } catch {
    return {}
  }
}

/** Clears after Purchase so the next visit starts fresh. */
export function clearUtms(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
