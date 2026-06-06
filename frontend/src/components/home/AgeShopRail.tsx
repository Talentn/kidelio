import { Link } from 'react-router-dom'
import { Baby, Footprints, Sparkles } from 'lucide-react'

const AGE_LINKS = [
  { label: '0 – 12 mois', sub: 'Naissance', to: '/produits?age=0-12', icon: Baby },
  { label: '1 – 3 ans', sub: 'Tout-petit', to: '/produits?age=1-3', icon: Baby },
  { label: '3 – 6 ans', sub: 'Préscolaire', to: '/produits?age=3-6', icon: Sparkles },
  { label: '6 – 12 ans', sub: 'Enfant', to: '/produits?age=6-12', icon: Sparkles },
  { label: 'Chaussures', sub: 'Toutes tailles', to: '/produits?q=chaussure', icon: Footprints },
] as const

export function AgeShopRail() {
  return (
    <section className="bg-white border-b border-gray-100 min-h-[inherit]">
      <div className="page-wrap py-6 md:py-8">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 text-center md:text-left">
          Acheter par âge
        </p>
        <div className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          {AGE_LINKS.map(({ label, sub, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex-shrink-0 flex flex-col items-center justify-center min-w-[100px] sm:min-w-[120px] md:flex-1 rounded-2xl border-2 border-gray-100 bg-warm hover:border-brand-300 hover:bg-brand-50/50 px-4 py-4 md:py-5 transition-all group"
            >
              <span className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Icon size={20} strokeWidth={2} />
              </span>
              <span className="font-bold text-sm text-gray-900 text-center leading-tight">{label}</span>
              <span className="text-[10px] text-gray-600 font-medium mt-0.5">{sub}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
