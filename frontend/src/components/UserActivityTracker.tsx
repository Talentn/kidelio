import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '../lib/userTracking'

/** Records page views for admin live activity (storefront only). */
export function UserActivityTracker() {
  const { pathname } = useLocation()
  const prev = useRef<string | null>(null)

  useEffect(() => {
    if (pathname === prev.current) return
    prev.current = pathname
    trackPageView(pathname)
  }, [pathname])

  return null
}
