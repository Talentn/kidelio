import { useCallback } from 'react'
import { trackFavorite } from '../lib/userTracking'

export function useFavoriteTracker() {
  const track = useCallback((action: 'add' | 'remove', productId: number, productName: string) => {
    trackFavorite(action, productId, productName)
  }, [])

  return { track }
}
