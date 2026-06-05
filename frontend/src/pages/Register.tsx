import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Lock, Loader2, AlertCircle, UserPlus, Package, Tag, Star, Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { trackCompleteRegistration } from '../lib/metaPixel'
import { SEO } from '../components/SEO'

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const form = new FormData(e.target as HTMLFormElement)
    try {
      await register({
        email: form.get('email') as string,
        password: form.get('password') as string,
        name: form.get('name') as string,
      })
      trackCompleteRegistration('email')
      navigate('/compte')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du compte.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100dvh-8rem)] flex items-center justify-center py-12 px-4">
      <SEO title="Créer un compte" url="/inscription" noIndex />
      <div className="w-full max-w-md animate-scale-in">
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-100 p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <span className="w-14 h-14 rounded-full bg-brand-500 text-white flex items-center justify-center mx-auto mb-4">
              <UserPlus size={26} strokeWidth={2} />
            </span>
            <h1 className="font-display text-2xl font-semibold text-ink mb-1">Créer un compte</h1>
            <p className="text-gray-500 text-sm">Rejoignez des milliers de familles satisfaites.</p>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {[
              { icon: Package, text: 'Suivi de commandes' },
              { icon: Tag, text: 'Offres exclusives' },
              { icon: Star, text: 'Points fidélité' },
              { icon: Bell, text: 'Alertes nouveautés' },
            ].map((b) => {
              const Icon = b.icon
              return (
                <div key={b.text} className="flex items-center gap-2 text-xs font-semibold text-gray-600 bg-gray-50 rounded-xl px-3 py-2">
                  <Icon size={14} className="text-brand-400 flex-shrink-0" />
                  {b.text}
                </div>
              )
            })}
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="input-label">Nom complet</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  name="name"
                  placeholder="Ahmed Ben Ali"
                  required
                  autoComplete="name"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="input-label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  name="email"
                  type="email"
                  placeholder="votre@email.com"
                  required
                  autoComplete="email"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="input-label">Mot de passe (8 caractères min.)</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="input pl-10"
                />
              </div>
            </div>

            {error && (
              <div className="alert-error">
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full justify-center py-3.5 mt-2"
            >
              {submitting ? (
                <><Loader2 size={17} className="animate-spin" /> Création en cours...</>
              ) : (
                'Créer mon compte'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            En créant un compte, vous acceptez nos conditions d'utilisation.
          </p>

          <p className="text-center text-sm text-gray-500 mt-4">
            Déjà inscrit ?{' '}
            <Link to="/connexion" className="text-brand-600 font-bold hover:text-brand-800 transition-colors">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
