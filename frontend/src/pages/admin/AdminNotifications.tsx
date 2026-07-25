import { useEffect, useState } from 'react'
import {
  Bell, BellOff, BellRing, Loader2, MessageCircle, MessageSquare,
  ShoppingCart, Smartphone, Send,
} from 'lucide-react'
import { AdminPage, Card, useToast } from '../../components/admin/ui'
import {
  PushPrefs, enablePush, disablePush, getPushStatus, isPushSupported,
  sendTestPush, updatePushPrefs,
} from '../../lib/webPush'

const DEFAULT_PREFS: PushPrefs = {
  notify_orders: true,
  notify_chat: true,
  notify_messages: true,
}

function Switch({ checked, onChange, disabled }: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-emerald-500' : 'bg-slate-300'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  )
}

export function AdminNotifications() {
  const { notify } = useToast()
  const supported = isPushSupported()

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [denied, setDenied] = useState(false)
  const [prefs, setPrefs] = useState<PushPrefs>(DEFAULT_PREFS)

  useEffect(() => {
    getPushStatus()
      .then((s) => {
        setSubscribed(s.subscribed)
        setDenied(s.permission === 'denied')
        if (s.prefs) setPrefs(s.prefs)
      })
      .finally(() => setLoading(false))
  }, [])

  const toggleMaster = async (on: boolean) => {
    setBusy(true)
    try {
      if (on) {
        const p = await enablePush()
        setPrefs(p)
        setSubscribed(true)
        setDenied(false)
        notify('Notifications activées sur cet appareil', 'success')
      } else {
        await disablePush()
        setSubscribed(false)
        notify('Notifications désactivées sur cet appareil', 'info')
      }
    } catch (err: unknown) {
      setDenied(typeof Notification !== 'undefined' && Notification.permission === 'denied')
      notify(err instanceof Error ? err.message : 'Une erreur est survenue', 'error')
    } finally {
      setBusy(false)
    }
  }

  const togglePref = async (key: keyof PushPrefs, value: boolean) => {
    const before = prefs
    setPrefs({ ...prefs, [key]: value })
    try {
      const p = await updatePushPrefs({ [key]: value })
      setPrefs(p)
    } catch (err: unknown) {
      setPrefs(before)
      notify(err instanceof Error ? err.message : 'Impossible de mettre à jour', 'error')
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      await sendTestPush()
      notify('Notification de test envoyée', 'success')
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Envoi impossible', 'error')
    } finally {
      setTesting(false)
    }
  }

  const EVENTS: { key: keyof PushPrefs; label: string; description: string; icon: typeof Bell }[] = [
    {
      key: 'notify_orders',
      label: 'Nouvelles commandes',
      description: 'Dès qu\u2019un client confirme une commande',
      icon: ShoppingCart,
    },
    {
      key: 'notify_chat',
      label: 'Chat support',
      description: 'Nouveau chat en attente ou message d\u2019un client',
      icon: MessageCircle,
    },
    {
      key: 'notify_messages',
      label: 'Messages de contact',
      description: 'Nouveau message envoyé via le formulaire de contact',
      icon: MessageSquare,
    },
  ]

  return (
    <AdminPage
      title="Notifications"
      subtitle="Recevez une alerte sur cet appareil même quand l'admin est fermé"
    >
      <div className="max-w-2xl space-y-4">
        {/* Master toggle */}
        <Card className="p-6">
          {loading ? (
            <div className="flex items-center gap-3 text-slate-400">
              <Loader2 size={18} className="animate-spin" /> Chargement...
            </div>
          ) : !supported ? (
            <div className="flex items-start gap-3">
              <BellOff size={22} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-slate-900">Navigateur non compatible</p>
                <p className="text-sm text-slate-500 mt-1">
                  Ce navigateur ne supporte pas les notifications push. Essayez Chrome, Edge ou Firefox.
                  Sur iPhone, ajoutez d'abord le site à l'écran d'accueil (Partager → Sur l'écran d'accueil).
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  subscribed ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {subscribed ? <BellRing size={19} /> : <Bell size={19} />}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">Notifications sur cet appareil</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {subscribed
                      ? 'Cet appareil reçoit les notifications push'
                      : 'Activez pour être alerté même quand l\u2019onglet est fermé'}
                  </p>
                </div>
              </div>
              {busy ? (
                <Loader2 size={20} className="animate-spin text-slate-400 flex-shrink-0" />
              ) : (
                <Switch checked={subscribed} onChange={toggleMaster} />
              )}
            </div>
          )}

          {denied && !subscribed && (
            <p className="mt-4 text-sm font-medium text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
              Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du
              navigateur (icône cadenas dans la barre d'adresse), puis réessayez.
            </p>
          )}
        </Card>

        {/* Per-event toggles */}
        <Card className="p-6">
          <h2 className="font-bold text-slate-900 mb-4">Types d'alertes</h2>
          <div className="divide-y divide-slate-100">
            {EVENTS.map(({ key, label, description, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3 min-w-0">
                  <Icon size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                  </div>
                </div>
                <Switch
                  checked={prefs[key]}
                  onChange={(v) => togglePref(key, v)}
                  disabled={!subscribed}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleTest}
            disabled={!subscribed || testing}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Envoyer une notification de test
          </button>
        </Card>

        {/* Phone hint */}
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <Smartphone size={20} className="text-brand-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-600 space-y-1.5">
              <p className="font-bold text-slate-900">Recevoir les alertes sur téléphone</p>
              <p>
                <span className="font-semibold">Android :</span> ouvrez cette page dans Chrome sur le
                téléphone et activez le bouton ci-dessus — c'est tout.
              </p>
              <p>
                <span className="font-semibold">iPhone :</span> ouvrez le site dans Safari, touchez
                Partager → « Sur l'écran d'accueil », puis ouvrez l'app installée et activez les
                notifications depuis cette page.
              </p>
              <p className="text-xs text-slate-400">
                Chaque appareil s'active séparément : activez-le sur votre ordinateur et sur votre téléphone.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AdminPage>
  )
}
