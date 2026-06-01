import { useEffect, useState } from 'react'
import { api, invalidateCache, peekCacheV1 } from '../api/client'
import type { ShopCategory } from '../lib/categories'

export function useShopCategories() {
  const [categories, setCategories] = useState<ShopCategory[]>(
    () => peekCacheV1<{ categories: ShopCategory[] }>('/categories')?.categories ?? []
  )

  useEffect(() => {
    invalidateCache('/api/v1/categories')
    api<{ categories: ShopCategory[] }>('/categories')
      .then((d) => setCategories(d.categories))
      .catch(() => {})
  }, [])

  return categories
}
