/**
 * Mount once inside <BrowserRouter>.
 * – Loads pixel ID from build env or /api/v1/store (runtime fallback).
 * – Activates the pixel when consent === 'all'.
 * – Fires exactly one PageView per route (no duplicate on landing).
 */
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api/client'
import { useStore } from '../context/StoreContext'
import {
  activatePixel,
  hasMarketingConsent,
  injectNoscript,
  isMetaPixelConfigured,
  isPixelReady,
  onPixelReady,
  rememberConsent,
  setMetaPixelId,
  trackPageView,
} from '../lib/metaPixelInit'
import { captureUtms } from '../lib/utm'

function activateIfConsented(): boolean {
  if (!isMetaPixelConfigured()) return false
  activatePixel()
  injectNoscript()
  return true
}

export function MetaPixel() {
  const location = useLocation()
  const { config } = useStore()
  const hydrated = useRef(false)
  const [pixelActive, setPixelActive] = useState(() => isPixelReady())

  useEffect(() => {
    captureUtms()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = config?.meta_pixel_id?.trim()
    if (id) setMetaPixelId(id)
  }, [config?.meta_pixel_id])

  useEffect(() => onPixelReady(() => setPixelActive(true)), [])

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true

    if (hasMarketingConsent() && activateIfConsented()) {
      setPixelActive(true)
    }

    api<{ consent: string | null }>('/consent')
      .then((d) => {
        if (d.consent === 'all') {
          rememberConsent('all')
          if (activateIfConsented()) setPixelActive(true)
        } else if (d.consent === 'essential') {
          rememberConsent('essential')
        }
      })
      .catch(() => { /* no pixel without consent */ })
  }, [])

  useEffect(() => {
    if (!isMetaPixelConfigured() || !pixelActive) return
    if (location.pathname.startsWith('/admin')) return
    trackPageView(location.pathname)
  }, [location.pathname, pixelActive])

  return null
}
