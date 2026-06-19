import { useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageLeave, trackPageView } from '../lib/userTracking'

const MIN_DWELL_MS = 500

/** Records page views and visible time-on-page (works on mobile + iOS). */
export function UserActivityTracker() {
  const { pathname } = useLocation()
  const pathRef = useRef(pathname)
  const accumulatedMsRef = useRef(0)
  const visibleSinceRef = useRef(Date.now())
  const flushedRef = useRef(false)

  pathRef.current = pathname

  const visibleMs = useCallback(() => {
    const active = document.hidden ? 0 : Date.now() - visibleSinceRef.current
    return accumulatedMsRef.current + active
  }, [])

  const resetTimer = useCallback(() => {
    accumulatedMsRef.current = 0
    visibleSinceRef.current = Date.now()
    flushedRef.current = false
  }, [])

  const flushPath = useCallback(
    (path: string, reason: 'navigation' | 'close' | 'background', useBeacon = false) => {
      if (path.startsWith('/admin') || flushedRef.current) return
      const durationMs = visibleMs()
      if (durationMs < MIN_DWELL_MS) return
      flushedRef.current = true
      trackPageLeave(path, durationMs, reason, useBeacon)
    },
    [visibleMs],
  )

  const flushCurrent = useCallback(
    (reason: 'navigation' | 'close' | 'background', useBeacon = false) => {
      flushPath(pathRef.current, reason, useBeacon)
    },
    [flushPath],
  )

  // Route change — flush previous page, start new
  useEffect(() => {
    if (pathname.startsWith('/admin')) return

    const pagePath = pathname
    resetTimer()
    trackPageView(pagePath)

    return () => {
      flushPath(pagePath, 'navigation')
    }
  }, [pathname, resetTimer, flushPath])

  // Pause/resume visible timer when app is backgrounded (critical on mobile)
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        accumulatedMsRef.current += Date.now() - visibleSinceRef.current
        flushCurrent('background', true)
      } else if (!pathRef.current.startsWith('/admin')) {
        resetTimer()
        trackPageView(pathRef.current)
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [flushCurrent, resetTimer])

  // Tab close / navigate away (pagehide is reliable on modern mobile browsers)
  useEffect(() => {
    const onPageHide = () => flushCurrent('close', true)
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && !pathRef.current.startsWith('/admin')) {
        resetTimer()
        trackPageView(pathRef.current)
      }
    }

    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [flushCurrent, resetTimer])

  return null
}
