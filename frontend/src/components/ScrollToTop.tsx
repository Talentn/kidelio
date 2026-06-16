import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { scrollWindowToTop } from '../lib/scrollToTop'

/** Reset window scroll when the route changes (SPA pages keep scroll position otherwise). */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    scrollWindowToTop()
    // Lazy chunks / images can shift layout after the first paint — pin top again.
    const raf = window.requestAnimationFrame(scrollWindowToTop)
    return () => window.cancelAnimationFrame(raf)
  }, [pathname])

  return null
}
