import { lazy, Suspense, useEffect, useState } from 'react'

const MetaPixel = lazy(() => import('./MetaPixel').then((m) => ({ default: m.MetaPixel })))
const CookieConsent = lazy(() => import('./CookieConsent').then((m) => ({ default: m.CookieConsent })))
const PromoPopup = lazy(() => import('./PromoPopup').then((m) => ({ default: m.PromoPopup })))
const ChatWidget = lazy(() => import('./ChatWidget').then((m) => ({ default: m.ChatWidget })))

/** Non-critical UI — loaded after first paint to shrink the critical JS path. */
export function DeferredWidgets() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const run = () => setReady(true)
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 2500 })
      return () => window.cancelIdleCallback(id)
    }
    const t = window.setTimeout(run, 1500)
    return () => window.clearTimeout(t)
  }, [])

  if (!ready) return null

  return (
    <Suspense fallback={null}>
      <MetaPixel />
      <CookieConsent />
      <PromoPopup />
      <ChatWidget />
    </Suspense>
  )
}
