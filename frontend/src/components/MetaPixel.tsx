/**
 * Mount once inside <BrowserRouter>.
 * – Fetches consent from the API a single time on app load.
 * – Activates the pixel if consent === 'all'.
 * – Fires PageView on every route change.
 * – Injects the <noscript> fallback after activation.
 */
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api/client'
import {
  activatePixel,
  injectNoscript,
  isMetaPixelConfigured,
  isPixelReady,
  trackPageView,
} from '../lib/metaPixelInit'
import { captureUtms } from '../lib/utm'

export function MetaPixel() {
  const location = useLocation()
  const hydrated = useRef(false)

  /* ── capture UTM / fbclid on every landing (not just first) ── */
  useEffect(() => {
    captureUtms()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── one-time consent hydration ── */
  useEffect(() => {
    if (!isMetaPixelConfigured() || hydrated.current) return
    hydrated.current = true

    api<{ consent: string | null }>('/consent')
      .then((d) => {
        if (d.consent === 'all') {
          activatePixel()
          injectNoscript()
          trackPageView() // first load
        }
      })
      .catch(() => { /* no pixel without consent */ })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── PageView on each SPA navigation ── */
  useEffect(() => {
    if (!isMetaPixelConfigured()) return
    if (location.pathname.startsWith('/admin')) return
    if (isPixelReady()) trackPageView()
  }, [location.pathname])

  return null
}
