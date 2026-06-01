import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'

export type HeroSlide = {
  id: number
  title?: string
  subtitle?: string
  link_url?: string
  image_url?: string
}

function slideLink(url?: string) {
  if (!url) return '/produits'
  if (url.startsWith('http') || url.startsWith('/')) return url
  return `/produits${url.startsWith('?') ? url : `?${url}`}`
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, 5500)
    return () => window.clearInterval(id)
  }, [slides.length])

  const slide = slides[index]
  const href = slideLink(slide.link_url)

  return (
    <section className="relative w-full overflow-hidden bg-[#FDF8F5]">
      <div className="relative min-h-[420px] sm:min-h-[480px] md:min-h-[560px] lg:min-h-[620px]">
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === index ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            {s.image_url ? (
              <img
                src={s.image_url}
                alt={s.title || 'Kidelio'}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-brand-100 to-sage-100" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
          </div>
        ))}

        <div className="relative z-20 page-wrap h-full min-h-[inherit] flex flex-col justify-center py-12 md:py-16">
          <span className="inline-flex text-brand-100 bg-white/15 backdrop-blur-sm text-xs font-bold px-3 py-1.5 rounded-full mb-4 w-fit">
            Collection été 2026
          </span>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.08] tracking-tight mb-4 max-w-xl drop-shadow-sm">
            {slide.title || (
              <>
                La mode qui <em className="not-italic text-brand-200">grandit</em> avec eux
              </>
            )}
          </h1>
          {(slide.subtitle || !slide.title) && (
            <p className="text-white/90 text-sm md:text-lg leading-relaxed mb-8 max-w-md">
              {slide.subtitle ||
                'Vêtements et accessoires pour bébés et enfants — livraison partout en Tunisie.'}
            </p>
          )}
          {href.startsWith('http') ? (
            <a
              href={href}
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-brand-50 text-gray-900 font-bold rounded-full px-8 py-3.5 transition-colors text-sm md:text-base w-fit shadow-lg"
            >
              Découvrir <ArrowRight size={16} />
            </a>
          ) : (
            <Link
              to={href}
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-brand-50 text-gray-900 font-bold rounded-full px-8 py-3.5 transition-colors text-sm md:text-base w-fit shadow-lg"
            >
              Découvrir <ArrowRight size={16} />
            </Link>
          )}
        </div>

        {slides.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Précédent"
              onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
              className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center text-gray-800 hover:bg-white"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label="Suivant"
              onClick={() => setIndex((i) => (i + 1) % slides.length)}
              className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center text-gray-800 hover:bg-white"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === index ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
