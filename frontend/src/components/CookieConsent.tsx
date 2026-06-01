import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Cookie, X } from 'lucide-react'
import { api } from '../api/client'
import { activatePixel, injectNoscript, isMetaPixelConfigured, trackPageView } from '../lib/metaPixel'

export function CookieConsent() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (location.pathname.startsWith('/admin')) {
      setVisible(false)
      return
    }

    api<{ consent: string | null }>('/consent')
      .then((d) => { if (!d.consent) setVisible(true) })
      .catch(() => setVisible(true))
  }, [location.pathname])

  const save = async (level: 'essential' | 'all') => {
    await api('/consent', { method: 'PATCH', body: JSON.stringify({ level }) })
    if (level === 'all' && isMetaPixelConfigured()) {
      activatePixel()
      injectNoscript()
      trackPageView()
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Consentement cookies"
      className="fixed bottom-[4.5rem] md:bottom-6 left-3 right-3 max-w-md mx-auto z-[300] bg-white rounded-2xl shadow-2xl shadow-gray-200 p-5 border border-gray-100 animate-slide-up"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Cookie size={18} className="text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm mb-1">Votre vie privée</p>
          <p className="text-gray-500 text-xs leading-relaxed">
            Nous utilisons des cookies pour le panier, la session et, si vous acceptez, la mesure
            d&apos;audience (Meta Pixel).
          </p>
        </div>
        <button
          type="button"
          onClick={() => save('essential')}
          className="p-1 text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          className="flex-1 text-xs font-bold py-2.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          onClick={() => save('essential')}
        >
          Essentiels seulement
        </button>
        <button
          type="button"
          className="flex-1 text-xs font-bold py-2.5 rounded-full bg-brand-500 text-white hover:bg-brand-700 transition-colors"
          onClick={() => save('all')}
        >
          Tout accepter
        </button>
      </div>
    </div>
  )
}
