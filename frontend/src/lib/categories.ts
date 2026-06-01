/** Public shop category tree from GET /api/v1/categories */
export type ShopCategory = {
  id: number
  name: string
  slug: string
  image_url?: string
  children?: ShopCategoryChild[]
}

export type ShopCategoryChild = {
  id: number
  name: string
  slug: string
  image_url?: string
  parent_id?: number
}

/** Admin category tree from GET /api/admin/categories */
export type AdminCategory = {
  id: number
  name: string
  slug: string
  description?: string
  position?: number
  active: boolean
  parent_id?: number | null
  parent_name?: string | null
  image_url?: string | null
  products_count?: number
  children_count?: number
  children?: AdminCategory[]
}

export type FlatCategoryOption = {
  id: number
  label: string
}

/** Options for product assignment: leaf categories only. */
export function leafCategoryOptions(tree: AdminCategory[]): FlatCategoryOption[] {
  const out: FlatCategoryOption[] = []
  for (const root of tree) {
    const kids = root.children ?? []
    if (kids.length > 0) {
      for (const ch of kids) {
        out.push({ id: ch.id, label: `${root.name} › ${ch.name}` })
      }
    } else {
      out.push({ id: root.id, label: root.name })
    }
  }
  return out
}

export function findShopCategory(
  tree: ShopCategory[],
  id: string | number | null | undefined
): ShopCategory | ShopCategoryChild | undefined {
  if (id == null || id === '') return undefined
  const sid = String(id)
  for (const root of tree) {
    if (String(root.id) === sid) return root
    for (const ch of root.children ?? []) {
      if (String(ch.id) === sid) return ch
    }
  }
  return undefined
}

export function countAdminCategories(tree: AdminCategory[]): number {
  return tree.reduce((n, r) => n + 1 + (r.children?.length ?? 0), 0)
}

/** Root id for a shop filter id (parent or sub). */
export function shopCategoryRootId(
  tree: ShopCategory[],
  categoryId: string | number | null | undefined
): string {
  if (categoryId == null || categoryId === '') return ''
  const sid = String(categoryId)
  for (const root of tree) {
    if (String(root.id) === sid) return sid
    for (const ch of root.children ?? []) {
      if (String(ch.id) === sid) return String(root.id)
    }
  }
  return ''
}

export function shopCategoryIsSub(
  tree: ShopCategory[],
  categoryId: string | number | null | undefined
): boolean {
  if (categoryId == null || categoryId === '') return false
  const sid = String(categoryId)
  for (const root of tree) {
    for (const ch of root.children ?? []) {
      if (String(ch.id) === sid) return true
    }
  }
  return false
}

export function resolveAdminCategoryIds(
  tree: AdminCategory[],
  categoryId: number | null | undefined
): { parentId: string; subId: string } {
  if (!categoryId) return { parentId: '', subId: '' }
  for (const root of tree) {
    if (root.id === categoryId) {
      return { parentId: String(root.id), subId: '' }
    }
    for (const ch of root.children ?? []) {
      if (ch.id === categoryId) {
        return { parentId: String(root.id), subId: String(ch.id) }
      }
    }
  }
  return { parentId: '', subId: '' }
}

/** Leaf category id to save on a product. */
export function effectiveAdminCategoryId(
  tree: AdminCategory[],
  parentId: string,
  subId: string
): string {
  if (!parentId) return ''
  const root = tree.find((r) => String(r.id) === parentId)
  if (!root) return ''
  const kids = root.children ?? []
  if (kids.length > 0) return subId
  return parentId
}
