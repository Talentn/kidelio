import { useCallback } from 'react'
import { goTrack, liveSessionId } from '../lib/goApi'

export function useFavoriteTracker() {
  const track = useCallback((action: 'add' | 'remove', productId: number, productName: string) => {
    goTrack('/favorites/events', {
      session_id: liveSessionId(),
      action,
      product_id: productId,
      product_name: productName,
    })
  }, [])

  return { track }
}
