/**
 * Mount once inside <BrowserRouter>.
 * – Fetches consent from the API a single time on app load.
 * – Activates the pixel if consent === 'all'.
 * – Fires exactly one PageView per route (no duplicate on landing).
 */
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api/client'
import {
  activatePixel,
  injectNoscript,
  isMetaPixelConfigured,
  isPixelReady,
  onPixelReady,
  trackPageView,
} from '../lib/metaPixelInit'
import { captureUtms } from '../lib/utm'

export function MetaPixel() {
  const location = useLocation()
  const hydrated = useRef(false)
  const [pixelActive, setPixelActive] = useState(() => isPixelReady())

  useEffect(() => {
    captureUtms()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── stay in sync when CookieConsent activates the pixel ── */
  useEffect(() => onPixelReady(() => setPixelActive(true)), [])

  /* ── one-time consent hydration (activate only — no PageView here) ── */
  useEffect(() => {
    if (!isMetaPixelConfigured() || hydrated.current) return
    hydrated.current = true

    api<{ consent: string | null }>('/consent')
      .then((d) => {
        if (d.consent === 'all') {
          activatePixel()
          injectNoscript()
          setPixelActive(true)
        }
      })
      .catch(() => { /* no pixel without consent */ })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── single PageView per route when pixel is active ── */
  useEffect(() => {
    if (!isMetaPixelConfigured() || !pixelActive) return
    if (location.pathname.startsWith('/admin')) return
    trackPageView(location.pathname)
  }, [location.pathname, pixelActive])

  return null
}
