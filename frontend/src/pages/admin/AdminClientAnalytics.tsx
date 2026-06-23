import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ShoppingCart, Eye, Users, Search, Heart, CreditCard, Clock,
  TrendingUp, TrendingDown, RefreshCw,
} from 'lucide-react'
import { apiAdmin } from '../../lib/api'
import { AdminPage, Card } from '../../components/admin/ui'
import { formatAdminDate, formatAdminDateTime, formatAdminRelative, formatPctChange } from '../../lib/adminDatetime'
import { formatDurationMs } from '../../lib/userTracking'
import { useLivePoll } from '../../hooks/useLivePoll'

const PERIODS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
] as const

type Period = (typeof PERIODS)[number]['value']

type Analytics = {
  period: string
  timezone: string
  from: string
  to: string
  kpis: {
    sessions: number
    product_views: number
    cart_adds: number
    cart_removals: number
    checkouts: number
    searches: number
    favorites: number
    avg_dwell_seconds: number
    conversion_cart_to_checkout_pct: number
  }
  previous_period: {
    sessions: number
    product_views: number
    cart_adds: number
    checkouts: number
    change_sessions_pct: number | null
    change_cart_adds_pct: number | null
    change_product_views_pct: number | null
  }
  activity_by_day: { date: string; cart_adds: number; product_views: number; sessions: number }[]
  activity_by_hour: { hour: number; label: string; events: number }[]
  top_viewed_products: { product_id: number | null; product_name: string; count: number }[]
  top_cart_products: { product_id: number | null; product_name: string; adds: number; quantity: number; revenue: number }[]
  top_searches: { query: string; count: number }[]
  recent_cart_adds: {
    id: number
    product_name: string
    quantity: number
    price: number
    color_label?: string
    size_label?: string
    user_name?: string
    session_id: string
    created_at: string
  }[]
  recent_activity: {
    id: number
    event_type: string
    path?: string
    product_name?: string
    metadata?: Record<string, unknown>
    user_name?: string
    session_id: string
    created_at: string
  }[]
}

const EVENT_LABELS: Record<string, string> = {
  page_view: 'Page vue',
  page_leave: 'Temps sur page',
  product_view: 'Produit consulté',
  search: 'Recherche',
  checkout_start: 'Checkout',
  favorite_add: 'Favori ajouté',
  favorite_remove: 'Favori retiré',
}

function KpiCard({
  label, value, sub, change, icon: Icon, accent,
}: {
  label: string
  value: string | number
  sub?: string
  change?: number | null
  icon: typeof ShoppingCart
  accent: string
}) {
  const up = change != null && change >= 0
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={18} />
        </div>
        {change != null && (
          <span className={`flex items-center gap-0.5 text-xs font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {formatPctChange(change)}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-3">{value}</p>
      <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </Card>
  )
}

function MiniStat({
  icon: Icon, label, value, tint,
}: {
  icon: typeof ShoppingCart
  label: string
  value: string | number
  tint: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon size={18} className={`${tint} flex-shrink-0`} />
      <div className="min-w-0">
        <p className="text-lg font-bold text-slate-900 leading-tight">{value}</p>
        <p className="text-[11px] text-slate-500 truncate">{label}</p>
      </div>
    </div>
  )
}

function activityDetail(ev: Analytics['recent_activity'][0]) {
  const m = ev.metadata ?? {}
  if (ev.event_type === 'page_leave' && m.duration_ms != null) {
    const extra = m.reason === 'background' ? ' · arrière-plan' : m.reason === 'close' ? ' · fermé' : ''
    return `${formatDurationMs(Number(m.duration_ms))}${extra}`
  }
  if (ev.event_type === 'search' && m.query) return `« ${String(m.query)} »`
  if (ev.event_type === 'checkout_start') {
    return `${m.item_count ?? '?'} art. · ${Number(m.total ?? 0).toFixed(3)} TND`
  }
  return ev.path ?? ''
}

export function AdminClientAnalytics() {
  const [period, setPeriod] = useState<Period>('7d')
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    return apiAdmin<Analytics>(`/client-analytics?period=${period}`)
      .then((d) => { setData(d); setError(false) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [period])

  useEffect(() => { load() }, [load])
  useLivePoll(() => load(true), [load], { interval: import.meta.env.PROD ? 30_000 : 15_000 })

  const maxHour = useMemo(
    () => Math.max(1, ...(data?.activity_by_hour.map((h) => h.events) ?? [1])),
    [data],
  )

  const maxDayCart = useMemo(
    () => Math.max(1, ...(data?.activity_by_day.map((d) => d.cart_adds) ?? [1])),
    [data],
  )

  if (loading && !data) {
    return (
      <AdminPage title="Comportement clients" subtitle="Chargement…">
        <div className="py-20 text-center text-slate-400">Chargement des KPI…</div>
      </AdminPage>
    )
  }

  const k = data?.kpis
  const prev = data?.previous_period

  return (
    <AdminPage
      title="Comportement clients"
      subtitle={data ? `Période : ${formatAdminDate(data.from)} → ${formatAdminDate(data.to)} (${data.timezone})` : 'KPI boutique'}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                period === p.value ? 'bg-brand-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-brand-300'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button type="button" onClick={() => load()} className="btn-sm btn-secondary flex items-center gap-1.5 ml-1">
            <RefreshCw size={14} /> Actualiser
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Impossible de charger les analytics. Vérifiez que les migrations sont à jour (<code className="text-xs">rails db:migrate</code>).
        </div>
      )}

      {k && (
        <>
          {/* Primary KPIs — the 4 numbers that matter most */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KpiCard icon={Users} label="Sessions uniques" value={k.sessions} change={prev?.change_sessions_pct} accent="bg-blue-50 text-blue-600" />
            <KpiCard icon={Eye} label="Vues produit" value={k.product_views} change={prev?.change_product_views_pct} accent="bg-indigo-50 text-indigo-600" />
            <KpiCard icon={ShoppingCart} label="Ajouts panier" value={k.cart_adds} change={prev?.change_cart_adds_pct} accent="bg-emerald-50 text-emerald-600" sub={`${k.cart_removals} retrait(s)`} />
            <KpiCard icon={CreditCard} label="Checkouts" value={k.checkouts} accent="bg-orange-50 text-orange-600" sub={`Conversion ${k.conversion_cart_to_checkout_pct}%`} />
          </div>

          {/* Secondary metrics — compact strip, not a wall of cards */}
          <Card className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 mb-6">
            <MiniStat icon={Clock} label="Temps moyen / page" value={`${k.avg_dwell_seconds}s`} tint="text-teal-600" />
            <MiniStat icon={Search} label="Recherches" value={k.searches} tint="text-violet-600" />
            <MiniStat icon={Heart} label="Favoris ajoutés" value={k.favorites} tint="text-pink-600" />
            <MiniStat icon={CreditCard} label="Conversion panier" value={`${k.conversion_cart_to_checkout_pct}%`} tint="text-orange-600" />
          </Card>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Activity by hour */}
            <Card className="p-5">
              <h3 className="font-bold text-slate-800 text-sm mb-4">Activité par heure (Tunisie)</h3>
              <div className="flex items-end gap-1 h-32">
                {data.activity_by_hour.map((h) => (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div
                      className="w-full bg-brand-400 rounded-t-sm min-h-[2px] transition-all"
                      style={{ height: `${Math.max(4, (h.events / maxHour) * 100)}%` }}
                      title={`${h.events} événements`}
                    />
                    {h.hour % 3 === 0 && <span className="text-[9px] text-slate-400">{h.label}</span>}
                  </div>
                ))}
              </div>
            </Card>

            {/* Activity by day */}
            <Card className="p-5">
              <h3 className="font-bold text-slate-800 text-sm mb-4">Ajouts panier / jour</h3>
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {data.activity_by_day.filter((d) => d.cart_adds > 0 || d.product_views > 0).slice(-14).map((d) => (
                  <div key={d.date} className="flex items-center gap-3 text-xs">
                    <span className="w-16 text-slate-500 flex-shrink-0">{formatAdminDate(d.date)}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(d.cart_adds / maxDayCart) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right font-bold text-slate-700">{d.cart_adds}</span>
                    <span className="w-12 text-right text-slate-400">{d.sessions} sess.</span>
                  </div>
                ))}
                {data.activity_by_day.every((d) => d.cart_adds === 0) && (
                  <p className="text-slate-400 text-sm">Aucune donnée sur cette période.</p>
                )}
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            {/* Top cart products */}
            <Card className="p-5">
              <h3 className="font-bold text-slate-800 text-sm mb-3">Top ajouts panier</h3>
              {data.top_cart_products.length === 0 ? (
                <p className="text-sm text-slate-400">Aucun ajout.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 text-left">
                      <th className="pb-2">Produit</th>
                      <th className="pb-2 text-right">Ajouts</th>
                      <th className="pb-2 text-right">TND</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.top_cart_products.map((p, i) => (
                      <tr key={`${p.product_id ?? 'na'}-${i}`}>
                        <td className="py-2 pr-2 font-medium text-slate-800 truncate max-w-[120px]">{p.product_name}</td>
                        <td className="py-2 text-right font-bold">{p.adds}</td>
                        <td className="py-2 text-right text-slate-500">{p.revenue.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Top viewed */}
            <Card className="p-5">
              <h3 className="font-bold text-slate-800 text-sm mb-3">Top produits consultés</h3>
              {data.top_viewed_products.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune vue.</p>
              ) : (
                <ul className="space-y-2">
                  {data.top_viewed_products.map((p, i) => (
                    <li key={`${p.product_id ?? 'na'}-${i}`} className="flex justify-between text-xs">
                      <span className="font-medium text-slate-800 truncate pr-2">{p.product_name}</span>
                      <span className="font-bold text-indigo-600 flex-shrink-0">{p.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Top searches */}
            <Card className="p-5">
              <h3 className="font-bold text-slate-800 text-sm mb-3">Recherches populaires</h3>
              {data.top_searches.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune recherche.</p>
              ) : (
                <ul className="space-y-2">
                  {data.top_searches.map((s, i) => (
                    <li key={`${s.query}-${i}`} className="flex justify-between text-xs">
                      <span className="text-slate-700 truncate pr-2">« {s.query} »</span>
                      <span className="font-bold text-violet-600">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Recent cart adds — detailed table */}
          <Card className="overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Derniers ajouts panier</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-2.5">Date & heure</th>
                    <th className="px-4 py-2.5">Produit</th>
                    <th className="px-4 py-2.5">Variante</th>
                    <th className="px-4 py-2.5 text-right">Qté</th>
                    <th className="px-4 py-2.5 text-right">Prix</th>
                    <th className="px-4 py-2.5">Visiteur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.recent_cart_adds.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aucun ajout panier enregistré.</td></tr>
                  ) : data.recent_cart_adds.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <p className="font-medium text-slate-800">{formatAdminDateTime(e.created_at)}</p>
                        <p className="text-[11px] text-slate-400">{formatAdminRelative(e.created_at)}</p>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">{e.product_name}</td>
                      <td className="px-4 py-2.5 text-xs text-brand-700">
                        {[e.color_label && `Couleur: ${e.color_label}`, e.size_label && `Taille: ${e.size_label}`].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold">×{e.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{e.price.toFixed(3)} TND</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {e.user_name ? `👤 ${e.user_name}` : `Session ${e.session_id.slice(0, 8)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Recent navigation */}
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Activité navigation récente</h3>
            </div>
            <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
              {data.recent_activity.length === 0 ? (
                <p className="px-5 py-8 text-center text-slate-400 text-sm">Aucune activité navigation.</p>
              ) : data.recent_activity.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 w-28 flex-shrink-0">
                    {EVENT_LABELS[e.event_type] ?? e.event_type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{e.product_name || activityDetail(e) || e.path || '—'}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {e.user_name ? e.user_name : `Session ${e.session_id.slice(0, 8)}`}
                    </p>
                  </div>
                  <time className="text-xs text-slate-500 flex-shrink-0 whitespace-nowrap">{formatAdminDateTime(e.created_at)}</time>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </AdminPage>
  )
}
