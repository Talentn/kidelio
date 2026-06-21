import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, User, Phone, Mail, Tag, CheckCircle, Loader2, Truck, ShoppingCart, Banknote, Home } from 'lucide-react'
import { api, peekCacheV1 } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { metaCatalogContentId } from '../lib/metaCatalogId'
import { trackInitiateCheckout, trackPromoCodeApplied, trackPurchase } from '../lib/metaPixel'
import { trackCheckoutStart } from '../lib/userTracking'
import { clearUtms, getStoredUtms } from '../lib/utm'
import { SEO } from '../components/SEO'
import { useStorePromoOffer } from '../hooks/useStorePromoOffer'

const GOVERNORATES = [
  'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan',
  'Bizerte', 'Béja', 'Jendouba', 'Kef', 'Siliana', 'Sousse',
  'Monastir', 'Mahdia', 'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid',
  'Gabès', 'Medenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kebili',
]

type SavedAddress = {
  id: number
  full_name: string
  phone: string
  governorate: string
  delegation: string
  street_address: string
  postal_code?: string
  label?: string
  is_default: boolean
}

function FieldGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <h2 className="flex items-center gap-2 font-bold text-gray-900 text-base mb-4">
        <span className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 flex-shrink-0">
          {icon}
        </span>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

export function Checkout() {
  const { items, total, count, clear, refresh } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [promo, setPromo] = useState('')
  const [discount, setDiscount] = useState(0)
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoAutoApplied, setPromoAutoApplied] = useState(false)
  const [promoManuallyEdited, setPromoManuallyEdited] = useState(false)
  const [error, setError] = useState('')
  const [promoError, setPromoError] = useState('')
  const [loading, setLoading] = useState(false)
  const [useWallet, setUseWallet] = useState(false)

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() =>
    peekCacheV1<{ addresses: SavedAddress[] }>('/addresses')?.addresses ?? []
  )
  const [addressMode, setAddressMode] = useState<'saved' | 'new'>('new')
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [saveAddress, setSaveAddress] = useState(true)

  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(user?.email ?? '')
  const [governorate, setGovernorate] = useState('')
  const [delegation, setDelegation] = useState('')
  const [streetAddress, setStreetAddress] = useState('')

  const promoIdentity = useMemo(
    () => ({
      guest_name: name,
      guest_phone: phone,
      shipping_governorate: governorate,
      shipping_delegation: delegation,
      shipping_address: streetAddress,
    }),
    [name, phone, governorate, delegation, streetAddress],
  )

  const {
    promo: storePromo,
    eligible: storePromoEligible,
    loading: storePromoLoading,
  } = useStorePromoOffer(promoIdentity)

  const walletBalance = Number(user?.wallet_balance ?? 0)

  useEffect(() => {
    refresh()
  }, [refresh])

  const walletDiscount = useWallet
    ? Math.min(walletBalance, Math.max(total - discount, 0))
    : 0
  const shipping = total >= 200 ? 0 : 7
  const grandTotal = total - discount - walletDiscount + shipping

  // Fire InitiateCheckout once — when items first become available
  const checkoutTracked = useRef(false)
  useEffect(() => {
    if (checkoutTracked.current || items.length === 0) return
    checkoutTracked.current = true
    trackInitiateCheckout({
      value: grandTotal,
      numItems: count,
      contentIds: items.map((i) => metaCatalogContentId(i.productId, i.colorId, i.sizeLabel)),
    })
    trackCheckoutStart(count, grandTotal)
  }, [items, grandTotal, count])

  useEffect(() => {
    if (!user) return

    const cached = peekCacheV1<{ addresses: SavedAddress[] }>('/addresses')
    if (cached?.addresses.length) {
      setSavedAddresses(cached.addresses)
      const defaultAddr = cached.addresses.find((a) => a.is_default) ?? cached.addresses[0]
      applyAddress(defaultAddr)
      setAddressMode('saved')
    }

    api<{ addresses: SavedAddress[] }>('/addresses')
      .then((d) => {
        setSavedAddresses(d.addresses)
        if (d.addresses.length > 0) {
          const defaultAddr = d.addresses.find((a) => a.is_default) ?? d.addresses[0]
          applyAddress(defaultAddr)
          setAddressMode('saved')
        }
      })
      .catch(() => {})
  }, [user])

  const applyAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id)
    setName(addr.full_name)
    setPhone(addr.phone)
    setGovernorate(addr.governorate)
    setDelegation(addr.delegation)
    setStreetAddress(addr.street_address)
  }

  const selectSavedAddress = (addr: SavedAddress) => {
    setAddressMode('saved')
    applyAddress(addr)
  }

  const validatePromoCode = useCallback(async (code: string, auto = false) => {
    const trimmed = code.trim()
    if (!trimmed) return false
    setPromoError('')
    try {
      const d = await api<{ valid: boolean; discount: number; error?: string }>('/promo-codes/validate', {
        method: 'POST',
        body: JSON.stringify({
          code: trimmed,
          subtotal: total,
          guest_name: name,
          guest_phone: phone,
          shipping_governorate: governorate,
          shipping_delegation: delegation,
          shipping_address: streetAddress,
        }),
      })
      if (d.valid) {
        const discountAmount = Number(d.discount)
        setPromo(trimmed.toUpperCase())
        setDiscount(discountAmount)
        setPromoApplied(true)
        setPromoAutoApplied(auto)
        trackPromoCodeApplied({ code: trimmed, discount: discountAmount, subtotal: total })
        return true
      }
      setPromoError('Code promo invalide')
      return false
    } catch (e: unknown) {
      setPromoError(e instanceof Error ? e.message : 'Code invalide')
      return false
    }
  }, [total, name, phone, governorate, delegation, streetAddress])

  const validatePromo = () => validatePromoCode(promo, false)

  useEffect(() => {
    if (storePromoLoading || promoManuallyEdited || !storePromo || !storePromoEligible) return
    if (promoApplied && promo === storePromo.code) return
    if (storePromo.min_order_amount != null && total < Number(storePromo.min_order_amount)) return

    validatePromoCode(storePromo.code, true)
  }, [
    storePromo,
    storePromoEligible,
    storePromoLoading,
    promoManuallyEdited,
    promoApplied,
    promo,
    total,
    validatePromoCode,
  ])

  useEffect(() => {
    if (
      storePromoLoading ||
      !promoApplied ||
      !storePromo ||
      promo !== storePromo.code ||
      storePromoEligible
    ) {
      return
    }

    setPromoApplied(false)
    setPromoAutoApplied(false)
    setDiscount(0)
    setPromo('')
    setPromoError('Ce code promo a déjà été utilisé pour ce client')
  }, [storePromo, storePromoEligible, storePromoLoading, promoApplied, promo])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const payload: Record<string, unknown> = {
      guest_name: name,
      guest_phone: phone,
      guest_email: email || undefined,
      shipping_governorate: governorate,
      shipping_delegation: delegation,
      shipping_address: streetAddress,
      promo_code: promo || undefined,
      payment_method: 'cash',
      use_wallet: useWallet && walletDiscount > 0,
      items: items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
        size_label: i.sizeLabel,
        color_label: i.colorLabel,
      })),
    }

    if (user && addressMode === 'saved' && selectedAddressId) {
      payload.address_id = selectedAddressId
    }
    if (user && addressMode === 'new') {
      payload.save_address = saveAddress
    }

    try {
      const purchaseValue = grandTotal
      const purchaseIds = items.map((i) => metaCatalogContentId(i.productId, i.colorId, i.sizeLabel))
      const purchaseCount = count

      const data = await api<{ order: { order_number: string } }>('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const utms = getStoredUtms()
      trackPurchase({
        value: purchaseValue,
        orderNumber: data.order.order_number,
        numItems: purchaseCount,
        contentIds: purchaseIds,
        promoCode: promoApplied && promo ? promo.trim() : undefined,
        discount: promoApplied ? discount : undefined,
        utms: Object.keys(utms).length ? utms as Record<string, string> : undefined,
      })
      clearUtms()

      clear()
      navigate(`/commande/${data.order.order_number}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="page-wrap py-16 text-center">
        <SEO title="Commande" url="/checkout" noIndex />
        <ShoppingCart size={48} strokeWidth={1.5} className="text-gray-300 mx-auto mb-4" />
        <h1 className="font-display font-semibold text-xl mb-4">Votre panier est vide</h1>
        <a href="/produits" className="btn-primary">Voir la boutique</a>
      </div>
    )
  }

  return (
    <div className="page-wrap py-6 md:py-10">
      <SEO title="Commande" url="/checkout" noIndex />
      <div className="flex items-center gap-3 mb-8 text-sm font-semibold">
        <span className="text-gray-400">Panier</span>
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-brand-600 font-bold">Commande</span>
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-gray-400">Confirmation</span>
      </div>

      <form onSubmit={submit}>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <FieldGroup title="Coordonnées" icon={<User size={16} />}>
              <div>
                <label className="input-label">Nom complet *</label>
                <input
                  name="name"
                  placeholder="Ex: Ahmed Ben Ali"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Téléphone *</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      name="phone"
                      placeholder="+216 XX XXX XXX"
                      required
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="input-label">Email (optionnel)</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      name="email"
                      placeholder="email@exemple.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input pl-10"
                    />
                  </div>
                </div>
              </div>
            </FieldGroup>

            <FieldGroup title="Adresse de livraison" icon={<MapPin size={16} />}>
              {user && savedAddresses.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Adresses enregistrées</p>
                  {savedAddresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                        addressMode === 'saved' && selectedAddressId === addr.id
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="address_choice"
                        checked={addressMode === 'saved' && selectedAddressId === addr.id}
                        onChange={() => selectSavedAddress(addr)}
                        className="mt-1 accent-brand-500"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                          <Home size={14} className="text-brand-500 flex-shrink-0" />
                          {addr.label || 'Adresse enregistrée'}
                          {addr.is_default && (
                            <span className="text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-bold">
                              Par défaut
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {addr.full_name} · {addr.phone}
                        </p>
                        <p className="text-xs text-gray-500">
                          {addr.street_address}, {addr.delegation}, {addr.governorate}
                        </p>
                      </div>
                    </label>
                  ))}
                  <label
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                      addressMode === 'new' ? 'border-brand-500 bg-brand-50' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="address_choice"
                      checked={addressMode === 'new'}
                      onChange={() => setAddressMode('new')}
                      className="accent-brand-500"
                    />
                    <span className="font-semibold text-sm text-gray-900">Utiliser une nouvelle adresse</span>
                  </label>
                </div>
              )}

              {(addressMode === 'new' || !user || savedAddresses.length === 0) && (
                <>
                  <div>
                    <label className="input-label">Gouvernorat *</label>
                    <select
                      name="governorate"
                      required
                      value={governorate}
                      onChange={(e) => setGovernorate(e.target.value)}
                      className="input"
                    >
                      <option value="">Choisir un gouvernorat</option>
                      {GOVERNORATES.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Délégation / Ville *</label>
                    <input
                      name="delegation"
                      placeholder="Ex: La Marsa"
                      required
                      value={delegation}
                      onChange={(e) => setDelegation(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="input-label">Adresse complète *</label>
                    <textarea
                      name="address"
                      placeholder="Numéro, rue, immeuble, étage..."
                      required
                      rows={3}
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      className="input resize-none"
                    />
                  </div>
                  {user && (
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="rounded accent-brand-500"
                      />
                      Enregistrer cette adresse pour mes prochaines commandes
                    </label>
                  )}
                </>
              )}

              <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3 font-semibold">
                <Truck size={14} />
                {shipping === 0
                  ? 'Vous bénéficiez de la livraison gratuite !'
                  : `Livraison: ${shipping.toFixed(3)} TND — Gratuite dès 200 TND d'achat`}
              </div>
            </FieldGroup>

            {user && walletBalance > 0 && (
              <FieldGroup title="Crédit boutique" icon={<Banknote size={16} />}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useWallet}
                    onChange={(e) => setUseWallet(e.target.checked)}
                    className="mt-1 rounded accent-brand-500"
                  />
                  <span className="text-sm text-gray-700">
                    Utiliser mon crédit disponible ({walletBalance.toFixed(3)} TND)
                    {useWallet && walletDiscount > 0 && (
                      <span className="block text-emerald-600 font-semibold mt-1">
                        -{walletDiscount.toFixed(3)} TND appliqués à cette commande
                      </span>
                    )}
                  </span>
                </label>
                <p className="text-xs text-gray-400">
                  Gagnez des récompenses sur{' '}
                  <a href="/recompenses" className="text-brand-600 font-semibold hover:underline">votre page fidélité</a>.
                </p>
              </FieldGroup>
            )}

            <FieldGroup title="Code promotionnel" icon={<Tag size={16} />}>
              {promoApplied ? (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3 font-semibold text-sm">
                  <CheckCircle size={16} />
                  Code «{promo}» appliqué{promoAutoApplied ? ' automatiquement' : ''} — Réduction de {discount.toFixed(3)} TND
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={promo}
                    onChange={(e) => {
                      setPromoManuallyEdited(true)
                      setPromo(e.target.value.toUpperCase())
                    }}
                    placeholder="CODE PROMO"
                    className="input flex-1 font-mono tracking-widest"
                  />
                  <button type="button" onClick={validatePromo} className="btn-ghost flex-shrink-0">
                    Appliquer
                  </button>
                </div>
              )}
              {promoError && <p className="text-red-500 text-xs font-medium">{promoError}</p>}
            </FieldGroup>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-24">
              <h2 className="font-display font-semibold text-ink text-lg mb-4">Votre commande</h2>

              <div className="space-y-2 mb-4 max-h-52 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <span className="text-gray-700 truncate pr-2 font-medium">
                      {item.name}{' '}
                      <span className="text-gray-400">×{item.quantity}</span>
                    </span>
                    <span className="font-bold text-gray-900 flex-shrink-0">
                      {(item.price * item.quantity).toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sous-total</span>
                  <span className="font-bold">{total.toFixed(3)} TND</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Réduction promo</span>
                    <span className="font-bold">-{discount.toFixed(3)} TND</span>
                  </div>
                )}
                {walletDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Crédit boutique</span>
                    <span className="font-bold">-{walletDiscount.toFixed(3)} TND</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Livraison</span>
                  <span className={`font-bold ${shipping === 0 ? 'text-emerald-600' : ''}`}>
                    {shipping === 0 ? 'Gratuite' : `${shipping.toFixed(3)} TND`}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-base">
                  <span>Total à payer</span>
                  <span className="text-brand-600">{grandTotal.toFixed(3)} TND</span>
                </div>
              </div>

              <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 text-center mt-3 font-medium">
                <Banknote size={14} /> Paiement en espèces à la livraison
              </p>

              {error && <div className="alert-error mt-4">{error}</div>}

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-5 py-4 text-base">
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> Envoi en cours...</>
                ) : (
                  <><CheckCircle size={18} /> Confirmer la commande</>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
