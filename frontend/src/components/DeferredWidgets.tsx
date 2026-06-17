import { lazy, Suspense, useEffect, useState } from 'react'
import { MetaPixel } from './MetaPixel'
import { CookieConsent } from './CookieConsent'

const PromoPopup = lazy(() => import('./PromoPopup').then((m) => ({ default: m.PromoPopup })))
const ChatWidget = lazy(() => import('./ChatWidget').then((m) => ({ default: m.ChatWidget })))

/** Non-critical UI — loaded after first paint to shrink the critical JS path. */
export function DeferredWidgets() {
  const [deferredReady, setDeferredReady] = useState(false)

  useEffect(() => {
    const run = () => setDeferredReady(true)
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 2500 })
      return () => window.cancelIdleCallback(id)
    }
    const t = window.setTimeout(run, 1500)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <>
      <MetaPixel />
      <CookieConsent />
      {deferredReady && (
        <Suspense fallback={null}>
          <PromoPopup />
          <ChatWidget />
        </Suspense>
      )}
    </>
  )
}
