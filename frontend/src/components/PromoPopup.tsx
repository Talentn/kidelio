import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { X, Gift, Sparkles, Truck, ArrowRight } from 'lucide-react'
import { api } from '../api/client'

type Promo = {
  id: number
  title?: string
  link_url?: string
  image_url: string
}

const PROMO_COOLDOWN_KEY = 'kidelio_promo_last_seen'
const COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 hours

function isOnCooldown() {
  try {
    const raw = localStorage.getItem(PROMO_COOLDOWN_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (Number.isNaN(ts)) return false
    return Date.now() - ts < COOLDOWN_MS
  } catch {
    return false
  }
}

function markPromoSeen() {
  try {
    localStorage.setItem(PROMO_COOLDOWN_KEY, String(Date.now()))
  } catch { /* private browsing */ }
}

function getExpiresAt() {
  try {
    const raw = localStorage.getItem(PROMO_COOLDOWN_KEY)
    const start = raw ? Number(raw) : Date.now()
    return (Number.isNaN(start) ? Date.now() : start) + COOLDOWN_MS
  } catch {
    return Date.now() + COOLDOWN_MS
  }
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function isExternal(url: string) {
  return /^https?:\/\//i.test(url)
}

export function PromoPopup() {
  const location = useLocation()
  const navigate = useNavigate()
  const [promo, setPromo] = useState<Promo | null>(null)
  const [visible, setVisible] = useState(false)
  const [remaining, setRemaining] = useState(COOLDOWN_MS)

  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return
    if (isOnCooldown()) return

    let cancelled = false
    let timer: number | undefined

    api<{ promos: Promo[] }>('/promo-popups')
      .then((d) => {
        if (cancelled || isOnCooldown()) return
        const next = d.promos[0] ?? null
        if (!next) return
        setPromo(next)
        timer = window.setTimeout(() => {
          if (!cancelled && !isOnCooldown()) setVisible(true)
        }, 1200)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [location.pathname])

  // Record view as soon as the popup is shown — once per visitor per 24h
  useEffect(() => {
    if (visible) markPromoSeen()
  }, [visible])

  // Live countdown until the 24h offer window ends
  useEffect(() => {
    if (!visible) return

    const tick = () => setRemaining(getExpiresAt() - Date.now())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [visible])

  const close = () => {
    markPromoSeen()
    setVisible(false)
  }

  const goToOffer = () => {
    markPromoSeen()
    setVisible(false)
    if (!promo?.link_url) return
    if (isExternal(promo.link_url)) {
      window.location.href = promo.link_url
    } else {
      navigate(promo.link_url)
    }
  }

  if (!visible || !promo) return null

  const headline = promo.title?.trim() || 'Offre exclusive'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={headline}
      className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/70"
        onClick={close}
      />

      {/* Shein-style promo card */}
      <div
        className="relative w-full sm:max-w-[380px] animate-slide-up sm:animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close — outside top-right like Shein */}
        <button
          type="button"
          onClick={close}
          className="absolute -top-11 right-3 sm:-top-12 sm:right-0 z-20 w-9 h-9 rounded-full bg-white/95 text-gray-800 shadow-lg flex items-center justify-center hover:bg-white transition-colors"
          aria-label="Fermer"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5">
          {/* Dark header band — Shein signature */}
          <div className="relative bg-ink px-5 pt-5 pb-6 text-center overflow-hidden">
            {/* Decorative sparkles */}
            <Sparkles size={14} className="absolute top-3 left-4 text-brand-300/60" />
            <Sparkles size={10} className="absolute top-5 right-8 text-gold-400/70" />
            <Sparkles size={12} className="absolute bottom-4 left-10 text-white/20" />

            <span className="inline-flex items-center gap-1.5 bg-brand-500 text-white text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-sm mb-3">
              <Gift size={12} />
              Cadeau bienvenue
            </span>

            <h2 className="font-display text-2xl sm:text-[1.65rem] font-bold text-white leading-tight tracking-tight">
              {headline}
            </h2>

            <p className="text-white/70 text-xs mt-2 font-medium">
              Réservé aux visiteurs Kidelio — aujourd&apos;hui seulement
            </p>
          </div>

          {/* Hero image — overlaps header slightly (Shein style) */}
          <div className="relative -mt-4 mx-4">
            <div className="rounded-xl overflow-hidden shadow-lg ring-2 ring-white bg-white">
              <img
                src={promo.image_url}
                alt={headline}
                className="w-full aspect-[4/3] object-cover"
              />
            </div>
            {/* Floating badge */}
            <span className="absolute -top-2 -left-1 bg-gold-500 text-ink text-[11px] font-black px-2.5 py-1 rounded-md shadow-md rotate-[-6deg]">
              HOT
            </span>
          </div>

          {/* Benefits row — Shein bullet perks */}
          <div className="flex items-center justify-center gap-4 px-5 pt-4 pb-1 text-[11px] font-semibold text-gray-500">
            <span className="flex items-center gap-1">
              <Truck size={13} className="text-brand-500" />
              Livraison rapide
            </span>
            <span className="w-px h-3 bg-gray-200" />
            <span className="flex items-center gap-1">
              <Gift size={13} className="text-brand-500" />
              Offre limitée
            </span>
          </div>

          {/* CTA block */}
          <div className="px-5 pt-3 pb-5 space-y-3">
            <button
              type="button"
              onClick={goToOffer}
              className="w-full bg-ink hover:bg-gray-800 text-white font-bold text-sm uppercase tracking-wider py-4 rounded-lg shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              J&apos;en profite
              <ArrowRight size={18} strokeWidth={2.5} />
            </button>

            <p className="text-center text-sm font-bold text-red-600 tabular-nums tracking-wide">
              Offre expire dans {formatCountdown(remaining)}
            </p>

            <button
              type="button"
              onClick={close}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 font-medium underline underline-offset-2 transition-colors py-1"
            >
              Non merci, continuer sans l&apos;offre
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
