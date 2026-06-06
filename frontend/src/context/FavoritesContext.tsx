import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { readFavoriteIds, writeFavoriteIds } from '../lib/favoritesStorage'
import { broadcast, onBroadcast } from '../lib/broadcast'
import { useFavoriteTracker } from '../hooks/useFavoriteTracker'

type FavoritesContextType = {
  ids: number[]
  count: number
  isFavorite: (productId: number) => boolean
  toggle: (productId: number, productName?: string) => void
  remove: (productId: number) => void
}

const FavoritesContext = createContext<FavoritesContextType | null>(null)

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<number[]>(() => readFavoriteIds())
  const { track } = useFavoriteTracker()

  useEffect(() => {
    return onBroadcast((event) => {
      if (event.type === 'favorites') {
        setIds(readFavoriteIds())
      }
    })
  }, [])

  const isFavorite = useCallback((productId: number) => ids.includes(productId), [ids])

  const toggle = useCallback((productId: number, productName = '') => {
    setIds((prev) => {
      const adding = !prev.includes(productId)
      const next = adding ? [...prev, productId] : prev.filter((id) => id !== productId)
      const saved = writeFavoriteIds(next)
      broadcast({ type: 'favorites', action: 'changed' })
      if (productName) {
        track(adding ? 'add' : 'remove', productId, productName)
      }
      return saved
    })
  }, [track])

  const remove = useCallback((productId: number) => {
    setIds((prev) => {
      const saved = writeFavoriteIds(prev.filter((id) => id !== productId))
      broadcast({ type: 'favorites', action: 'changed' })
      return saved
    })
  }, [])

  return (
    <FavoritesContext.Provider value={{ ids, count: ids.length, isFavorite, toggle, remove }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
