import { useEffect, useMemo, useState } from 'react'
import { apiV1Fresh } from '../lib/api'
import {
  buildStoreOfferQuery,
  type StorePromoIdentity,
  type StorePromoOffer,
  type StorePromoResponse,
} from '../lib/storePromo'

type UseStorePromoOfferResult = {
  promo: StorePromoOffer | null
  eligible: boolean
  firstTimeUnknown: boolean
  loading: boolean
}

export function useStorePromoOffer(identity?: StorePromoIdentity): UseStorePromoOfferResult {
  const [promo, setPromo] = useState<StorePromoOffer | null>(null)
  const [eligible, setEligible] = useState(false)
  const [firstTimeUnknown, setFirstTimeUnknown] = useState(false)
  const [loading, setLoading] = useState(true)

  const query = useMemo(() => buildStoreOfferQuery(identity), [
    identity?.guest_name,
    identity?.guest_phone,
    identity?.shipping_governorate,
    identity?.shipping_delegation,
    identity?.shipping_address,
  ])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    apiV1Fresh<StorePromoResponse>(`/promo-codes/store-offer${query}`)
      .then((data) => {
        if (cancelled) return
        if (!data.promo) {
          setPromo(null)
          setEligible(false)
          setFirstTimeUnknown(false)
          return
        }
        setPromo(data.promo)
        setEligible(data.eligible)
        setFirstTimeUnknown(data.first_time_unknown)
      })
      .catch(() => {
        if (cancelled) return
        setPromo(null)
        setEligible(false)
        setFirstTimeUnknown(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [query])

  return { promo, eligible, firstTimeUnknown, loading }
}
