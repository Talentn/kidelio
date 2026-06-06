import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Gift, Star, Wallet, Ticket, Loader2, CheckCircle } from 'lucide-react'
import { api, invalidateCache } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { broadcast } from '../lib/broadcast'
import { SEO } from '../components/SEO'

type RewardsData = {
  spend_threshold: number
  spend_progress: number
  spend_remaining: number
  progress_percent: number
  can_claim: boolean
  reward_points: number
  reward_value_tnd: number
  wallet_balance: number
  fidelity_points: number
}

export function Rewards() {
  const { user, refresh } = useAuth()
  const [data, setData] = useState<RewardsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<'coupon' | 'wallet' | null>(null)
  const [claimedCode, setClaimedCode] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api<{ rewards: RewardsData }>('/rewards')
      .then((d) => setData(d.rewards))
      .catch(() => setError('Impossible de charger vos récompenses'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const claim = async (type: 'coupon' | 'wallet') => {
    setClaiming(type)
    setError('')
    setClaimedCode(null)
    try {
      const res = await api<{
        ok: boolean
        reward: { type: string; code?: string; amount?: number }
        rewards: RewardsData
      }>('/rewards/claim', {
        method: 'POST',
        body: JSON.stringify({ type }),
      })
      setData(res.rewards)
      if (res.reward.type === 'coupon' && res.reward.code) {
        setClaimedCode(res.reward.code)
      }
      invalidateCache('/api/v1/auth')
      await refresh()
      broadcast({ type: 'auth', action: 'refresh' })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la réclamation')
    } finally {
      setClaiming(null)
    }
  }

  if (!user) return <Navigate to="/connexion" replace />

  const progress = data?.progress_percent ?? 0

  return (
    <div className="page-wrap py-8 md:py-10">
      <SEO title="Mes récompenses" description="Programme fidélité Kidelio — gagnez des points et des avantages." />

      <div className="mb-8">
        <h1 className="font-display font-semibold text-2xl md:text-3xl text-ink mb-2">Mes récompenses</h1>
        <p className="text-gray-500 text-sm">
          Dépensez {data?.spend_threshold ?? 300} TND en achats livrés (hors livraison) pour débloquer{' '}
          {data?.reward_points?.toLocaleString('fr-FR') ?? '10 000'} points = {data?.reward_value_tnd ?? 10} TND
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-brand-500" size={32} />
        </div>
      ) : data ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Progress */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
                <Star className="text-amber-500" size={24} />
              </div>
              <div>
                <p className="font-bold text-gray-900">Progression</p>
                <p className="text-sm text-gray-500">Commandes livrées uniquement, hors frais de livraison</p>
              </div>
            </div>

            <div className="mb-3 flex justify-between text-sm font-semibold">
              <span className="text-gray-600">{Number(data.spend_progress).toFixed(3)} TND</span>
              <span className="text-brand-600">{Number(data.spend_threshold).toFixed(0)} TND</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">
              {data.can_claim
                ? 'Félicitations ! Vous pouvez réclamer votre récompense.'
                : `Plus que ${Number(data.spend_remaining).toFixed(3)} TND pour débloquer ${data.reward_points.toLocaleString('fr-FR')} points.`}
            </p>

            <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs text-gray-500 font-semibold mb-1">Points de fidélité</p>
                <p className="text-xl font-bold text-gray-900">{data.fidelity_points.toLocaleString('fr-FR')}</p>
                <p className="text-[11px] text-gray-400 mt-1">Attribués après chaque récompense réclamée</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs text-gray-500 font-semibold mb-1">Crédit boutique</p>
                <p className="text-xl font-bold text-brand-600">{Number(data.wallet_balance).toFixed(3)} TND</p>
              </div>
            </div>
          </div>

          {/* Claim */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center">
                <Gift className="text-brand-600" size={24} />
              </div>
              <div>
                <p className="font-bold text-gray-900">Réclamer {data.reward_points.toLocaleString('fr-FR')} points</p>
                <p className="text-sm text-gray-500">Valeur : {Number(data.reward_value_tnd).toFixed(3)} TND</p>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 font-medium mb-4">{error}</p>}

            {claimedCode && (
              <div className="mb-4 flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-emerald-800">
                <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Code promo créé : {claimedCode}</p>
                  <p className="text-emerald-700 mt-1">-10% sur votre prochaine commande (usage unique).</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                disabled={!data.can_claim || claiming !== null}
                onClick={() => claim('coupon')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-brand-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center flex-shrink-0">
                  {claiming === 'coupon' ? <Loader2 size={18} className="animate-spin text-pink-500" /> : <Ticket size={18} className="text-pink-500" />}
                </div>
                <div>
                  <p className="font-bold text-gray-900">Coupon -10%</p>
                  <p className="text-xs text-gray-500">Code personnel valable 90 jours, 1 utilisation</p>
                </div>
              </button>

              <button
                type="button"
                disabled={!data.can_claim || claiming !== null}
                onClick={() => claim('wallet')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-brand-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                  {claiming === 'wallet' ? <Loader2 size={18} className="animate-spin text-brand-600" /> : <Wallet size={18} className="text-brand-600" />}
                </div>
                <div>
                  <p className="font-bold text-gray-900">Crédit boutique</p>
                  <p className="text-xs text-gray-500">{Number(data.reward_value_tnd).toFixed(3)} TND utilisables au paiement</p>
                </div>
              </button>
            </div>

            {Number(data.wallet_balance) > 0 && (
              <p className="text-xs text-gray-500 mt-4">
                Utilisez votre crédit au{' '}
                <Link to="/checkout" className="text-brand-600 font-semibold hover:underline">paiement</Link>.
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-center text-gray-500 py-12">{error || 'Erreur de chargement'}</p>
      )}
    </div>
  )
}
