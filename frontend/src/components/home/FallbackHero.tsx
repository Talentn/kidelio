import { Link } from 'react-router-dom'
import { ArrowRight, Star, Truck } from 'lucide-react'

/** Static hero when no admin sliders are configured */
export function FallbackHero({ heroImage = '/hero-kids.png' }: { heroImage?: string }) {
  return (
    <section className="relative w-full overflow-hidden bg-[#FDF8F5]">
      <div className="flex flex-col md:flex-row min-h-[520px] md:min-h-[620px] lg:min-h-[700px]">
        <div className="flex-1 flex flex-col justify-center px-6 xs:px-8 sm:px-12 lg:px-20 py-14 md:py-0 order-2 md:order-1">
          <span className="inline-flex items-center gap-1.5 text-brand-700 bg-brand-100 text-xs font-bold px-3 py-1.5 rounded-full mb-5 w-fit">
            Nouvelle collection été 2026
          </span>
          <h1 className="font-display text-4xl xs:text-5xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 leading-[1.08] tracking-tight mb-5">
            La mode qui
            <br />
            <em className="not-italic text-brand-500">grandit</em>
            <br />
            avec eux
          </h1>
          <p className="text-gray-500 text-sm xs:text-base lg:text-lg leading-relaxed mb-8 max-w-md">
            Vêtements, chaussures et accessoires pour bébés et enfants. Livraison partout en Tunisie.
            Paiement à la livraison.
          </p>
          <div className="flex flex-col xs:flex-row gap-3 mb-8">
            <Link
              to="/produits"
              className="inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-full px-8 py-3.5 transition-colors text-sm xs:text-base shadow-sm"
            >
              Découvrir la boutique <ArrowRight size={16} />
            </Link>
            <Link
              to="/produits?featured=true"
              className="inline-flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-700 hover:border-gray-900 hover:text-gray-900 font-semibold rounded-full px-8 py-3.5 transition-colors text-sm xs:text-base"
            >
              Coups de cœur
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-gray-500 text-xs font-medium">Plus de 500 familles satisfaites</span>
          </div>
        </div>
        <div className="relative w-full md:w-[52%] lg:w-[55%] order-1 md:order-2 h-72 xs:h-80 sm:h-96 md:h-auto overflow-hidden">
          <img
            src={heroImage}
            alt="Kidelio — Mode enfants"
            className="w-full h-full object-cover object-center"
          />
          <div className="hidden md:block absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#FDF8F5] to-transparent pointer-events-none" />
          <div className="hidden md:flex absolute bottom-8 left-8 bg-white rounded-2xl shadow-lg px-4 py-3 items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
              <Truck size={16} className="text-brand-600" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Livraison rapide</p>
              <p className="text-xs font-bold text-gray-900">Partout en Tunisie</p>
            </div>
          </div>
          <div className="absolute top-5 right-5 bg-amber-400 text-gray-900 font-bold text-xs px-3 py-1.5 rounded-full shadow">
            Paiement à la livraison
          </div>
        </div>
      </div>
    </section>
  )
}
