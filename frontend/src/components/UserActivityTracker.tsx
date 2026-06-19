import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageLeave, trackPageView } from '../lib/userTracking'

const MIN_DWELL_MS = 500

/** Records page views and time-on-page until navigation or tab close. */
export function UserActivityTracker() {
  const { pathname } = useLocation()
  const pathRef = useRef(pathname)
  const openedAtRef = useRef(Date.now())
  const flushedRef = useRef(false)

  pathRef.current = pathname

  useEffect(() => {
    if (pathname.startsWith('/admin')) return

    flushedRef.current = false
    openedAtRef.current = Date.now()
    trackPageView(pathname)

    return () => {
      if (flushedRef.current || pathname.startsWith('/admin')) return
      const durationMs = Date.now() - openedAtRef.current
      if (durationMs < MIN_DWELL_MS) return
      flushedRef.current = true
      trackPageLeave(pathname, durationMs, 'navigation')
    }
  }, [pathname])

  useEffect(() => {
    const onPageHide = () => {
      const path = pathRef.current
      if (path.startsWith('/admin') || flushedRef.current) return
      const durationMs = Date.now() - openedAtRef.current
      if (durationMs < MIN_DWELL_MS) return
      flushedRef.current = true
      trackPageLeave(path, durationMs, 'close', true)
    }

    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [])

  return null
}
