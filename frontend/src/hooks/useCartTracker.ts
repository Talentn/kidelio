// Sends cart add/remove events to the Go service over HTTP.
import { useCallback } from 'react'
import { goTrack, liveSessionId } from '../lib/goApi'

type CartAction = 'add' | 'remove' | 'update' | 'clear'

interface CartEventPayload {
  action: CartAction
  product_id?: number
  product_name?: string
  quantity?: number
  price?: number
  color_id?: number
  color_label?: string
  size_label?: string
}

export function useCartTracker() {
  const track = useCallback((payload: CartEventPayload) => {
    goTrack('/cart/events', { session_id: liveSessionId(), ...payload })
  }, [])

  return { track }
}
