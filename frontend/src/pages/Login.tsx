import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Lock, Loader2, AlertCircle, Rabbit } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import { SEO } from '../components/SEO'

function afterLoginPath(role: string) {
  return role === 'admin' || role === 'employee' ? '/admin' : '/compte'
}

export function Login() {
  const { login, user, loading } = useAuth()
  const { config } = useStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (loading) return
    if (user) navigate(afterLoginPath(user.role), { replace: true })
  }, [user, loading, navigate])

  useEffect(() => {
    if (searchParams.get('error') === 'oauth') {
      setError('Connexion Google impossible. Réessayez ou utilisez email / mot de passe.')
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const form = new FormData(e.target as HTMLFormElement)
    try {
      const loggedIn = await login(form.get('email') as string, form.get('password') as string)
      navigate(afterLoginPath(loggedIn.role))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Email ou mot de passe incorrect.')
    } finally {
      setSubmitting(false)
    }
  }

  const googleEnabled = config?.google_auth === true

  return (
    <div className="min-h-[calc(100dvh-8rem)] flex items-center justify-center py-12 px-4">
      <SEO title="Connexion" url="/connexion" noIndex />
      <div className="w-full max-w-md animate-scale-in">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-100 p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <span className="w-14 h-14 rounded-full bg-brand-500 text-white flex items-center justify-center mx-auto mb-4">
              <Rabbit size={28} strokeWidth={2} />
            </span>
            <h1 className="font-display text-2xl font-semibold text-ink mb-1">Bon retour</h1>
            <p className="text-gray-500 text-sm">Connectez-vous pour accéder à votre compte.</p>
          </div>

          {/* Google OAuth */}
          {googleEnabled ? (
            <a
              href="/users/auth/google_oauth2"
              className="flex items-center justify-center gap-3 w-full border-2 border-gray-200 rounded-full py-3 font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all mb-5 text-sm"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
              </svg>
              Continuer avec Google
            </a>
          ) : (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 font-medium mb-5">
              Google OAuth non configuré. Définissez <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_ID</code> dans <code className="bg-amber-100 px-1 rounded">api/.env</code>.
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-3">
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
              <label className="input-label">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
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
                <><Loader2 size={17} className="animate-spin" /> Connexion...</>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          {/* Footer links */}
          <p className="text-center text-sm text-gray-500 mt-6">
            Pas encore de compte ?{' '}
            <Link to="/inscription" className="text-brand-600 font-bold hover:text-brand-800 transition-colors">
              Créer un compte
            </Link>
          </p>

          <p className="text-center text-xs text-gray-400 mt-3">
            Personnel: admin@kids-shop.local / password123
          </p>
        </div>
      </div>
    </div>
  )
}
