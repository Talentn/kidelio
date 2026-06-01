import { Heart, Leaf, ShieldCheck, Truck } from 'lucide-react'

const VALUES = [
  {
    icon: ShieldCheck,
    title: 'Qualité pour enfants',
    text: 'Des pièces sélectionnées pour le confort et la durabilité au quotidien.',
  },
  {
    icon: Truck,
    title: 'Livraison en Tunisie',
    text: 'Expédition rapide vers toutes les régions, suivi de commande en ligne.',
  },
  {
    icon: Leaf,
    title: 'Paiement à la livraison',
    text: 'Payez en espèces à la réception — simple et rassurant pour les familles.',
  },
  {
    icon: Heart,
    title: 'Service attentionné',
    text: 'Une équipe à votre écoute pour tailles, échanges et conseils.',
  },
] as const

export function ValuesStrip() {
  return (
    <section className="page-wrap py-10 md:py-14 border-t border-gray-100">
      <div className="text-center mb-8 md:mb-10">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900">Pourquoi Kidelio ?</h2>
        <p className="text-gray-500 text-sm mt-2 max-w-lg mx-auto">
          L&apos;expérience des boutiques enfants européennes, adaptée aux familles tunisiennes.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        {VALUES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="text-center px-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3">
              <Icon size={22} strokeWidth={2} />
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1.5">{title}</h3>
            <p className="text-gray-500 text-xs leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
