import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Lock, Loader2, AlertCircle, UserPlus, Package, Tag, Star, Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import { trackCompleteRegistration } from '../lib/metaPixel'
import { SEO } from '../components/SEO'

export function Register() {
  const { register } = useAuth()
  const { config } = useStore()
  const navigate = useNavigate()
  const googleEnabled = config?.google_auth === true
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

          {/* Google OAuth */}
          {googleEnabled && (
            <a
              href="/users/auth/google_oauth2"
              className="flex items-center justify-center gap-3 w-full border-2 border-gray-200 rounded-full py-3 font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all mb-6 text-sm"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
              </svg>
              Continuer avec Google
            </a>
          )}

          {googleEnabled && (
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">ou</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
          )}

          {/* Benefits */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {[
              { icon: Package, text: 'Suivi de commandes' },
              { icon: Tag, text: 'Offres exclusives' },
              { icon: Star, text: 'Points de fidélité' },
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
