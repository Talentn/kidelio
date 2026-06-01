import { FormEvent, useState } from 'react'
import { User, Mail, Phone, MessageSquare, Send, CheckCircle, AlertCircle } from 'lucide-react'
import { api } from '../api/client'
import { trackContact } from '../lib/metaPixel'

export function Contact() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)
    const form = new FormData(e.target as HTMLFormElement)
    try {
      await api('/contact', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          phone: form.get('phone'),
          message: form.get('message'),
        }),
      })
      trackContact()
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue. Réessayez.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-r from-brand-50 to-sage-50 border-b border-brand-100">
        <div className="page-wrap py-10 md:py-14">
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-2">Contactez-nous</h1>
          <p className="text-gray-600 text-base max-w-lg">
            Une question sur une commande, un produit, ou simplement envie de nous dire bonjour ? On est là !
          </p>
        </div>
      </div>

      <div className="page-wrap py-10">
        <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
          {/* Contact info */}
          <div>
            <h2 className="font-display font-semibold text-ink text-xl mb-6">Informations de contact</h2>
            <div className="space-y-4 mb-8">
              {[
                { icon: <Phone size={18} />, label: 'Téléphone', value: '+216 XX XXX XXX', sub: 'Disponible 7j/7 de 9h à 20h' },
                { icon: <Mail size={18} />, label: 'Email', value: 'contact@kids-shop.tn', sub: 'Réponse sous 24h' },
                { icon: <MessageSquare size={18} />, label: 'WhatsApp', value: '+216 XX XXX XXX', sub: 'Messagerie instantanée' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-4 p-4 bg-white rounded-2xl shadow-sm">
                  <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 flex-shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{item.label}</p>
                    <p className="text-brand-600 font-semibold text-sm">{item.value}</p>
                    <p className="text-gray-400 text-xs">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* FAQ */}
            <div className="bg-gradient-to-br from-brand-50 to-sage-50 rounded-2xl p-6">
              <h3 className="font-display font-semibold text-ink mb-4">Questions fréquentes</h3>
              <div className="space-y-3">
                {[
                  { q: 'Quels sont les délais de livraison ?', a: '2 à 5 jours ouvrables selon votre gouvernorat.' },
                  { q: 'Puis-je échanger un article ?', a: 'Oui, dans les 7 jours suivant la réception.' },
                  { q: 'Livrez-vous partout en Tunisie ?', a: 'Oui, dans tous les gouvernorats.' },
                ].map((faq) => (
                  <div key={faq.q} className="bg-white rounded-xl p-4">
                    <p className="font-bold text-gray-900 text-sm mb-1">{faq.q}</p>
                    <p className="text-gray-500 text-xs">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Contact form */}
          <div>
            {sent ? (
              <div className="text-center py-12 animate-scale-in">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle size={40} className="text-emerald-500" />
                </div>
                <h2 className="font-display font-semibold text-ink text-2xl mb-3">Message envoyé</h2>
                <p className="text-gray-500 max-w-sm mx-auto">
                  Merci pour votre message. Notre équipe vous répondra dans les plus brefs délais.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="btn-ghost mt-6"
                >
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-sm p-6 md:p-8">
                <h2 className="font-display font-semibold text-ink text-xl mb-6">Envoyer un message</h2>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div>
                    <label className="input-label">Nom complet *</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input name="name" placeholder="Ahmed Ben Ali" required className="input pl-10" />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="input-label">Email *</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input name="email" type="email" placeholder="email@exemple.com" required className="input pl-10" />
                      </div>
                    </div>
                    <div>
                      <label className="input-label">Téléphone</label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input name="phone" type="tel" placeholder="+216 XX XXX XXX" className="input pl-10" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Message *</label>
                    <textarea
                      name="message"
                      placeholder="Dites-nous comment nous pouvons vous aider..."
                      required
                      rows={5}
                      className="input resize-none"
                    />
                  </div>

                  {error && (
                    <div className="alert-error">
                      <AlertCircle size={15} />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={sending}
                    className="btn-primary w-full justify-center py-3.5"
                  >
                    {sending ? (
                      <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Envoi...</>
                    ) : (
                      <><Send size={16} /> Envoyer le message</>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
