import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api/client'
import { activatePixel, injectNoscript, isMetaPixelConfigured, trackPageView } from '../lib/metaPixelInit'

export function CookieConsent() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (location.pathname.startsWith('/admin')) {
      setVisible(false)
      return
    }
    api<{ consent: string | null }>('/consent')
      .then((d) => { if (!d.consent) setVisible(true) })
      .catch(() => setVisible(true))
  }, [location.pathname])

  const accept = async () => {
    await api('/consent', { method: 'PATCH', body: JSON.stringify({ level: 'all' }) })
    if (isMetaPixelConfigured()) {
      activatePixel()
      injectNoscript()
      // MetaPixel route effect also fires PageView; dedup prevents doubles
      trackPageView(window.location.pathname)
    }
    setVisible(false)
  }

  const decline = async () => {
    await api('/consent', { method: 'PATCH', body: JSON.stringify({ level: 'essential' }) })
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Consentement cookies"
      className="fixed bottom-[4.5rem] md:bottom-6 left-3 right-3 max-w-sm mx-auto z-[300] bg-white rounded-2xl shadow-2xl shadow-gray-200 p-5 border border-gray-100 animate-slide-up"
    >
      <p className="font-bold text-gray-900 text-sm mb-1">🍪 Nous utilisons des cookies</p>
      <p className="text-gray-500 text-xs leading-relaxed mb-4">
        Pour améliorer votre expérience d&apos;achat et vous proposer des offres personnalisées.
      </p>

      <button
        type="button"
        onClick={accept}
        className="w-full text-sm font-bold py-3 rounded-full bg-brand-700 text-white hover:bg-brand-800 transition-colors shadow-sm"
      >
        Accepter et continuer
      </button>

      {/* Nearly invisible "see more" */}
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full mt-2 text-[11px] text-gray-500 hover:text-gray-600 transition-colors text-center"
        >
          voir plus
        </button>
      )}

      {expanded && (
        <button
          type="button"
          onClick={decline}
          className="w-full mt-2 text-[11px] text-gray-500 hover:text-gray-700 transition-colors text-center underline underline-offset-2"
        >
          Cookies nécessaires uniquement
        </button>
      )}
    </div>
  )
}
