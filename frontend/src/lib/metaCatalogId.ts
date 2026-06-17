/** Matches FacebookCatFeedController#variant_catalog_id (Rails parameterize). */
function slugSize(label: string): string {
  return (
    label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'one-size'
  )
}

/** Meta catalog / Pixel content_id for a product variant. */
export function metaCatalogContentId(
  productId: number,
  colorId?: number | null,
  sizeLabel?: string | null,
): string {
  const parts = [String(productId)]
  if (colorId) {
    parts.push(`c${colorId}`)
    if (sizeLabel) parts.push(slugSize(sizeLabel))
  }
  return parts.join('-')
}

type CatalogProduct = {
  id: number
  colors?: Array<{ id: number; position?: number; sizes?: Array<{ size: string }> }>
}

/** Default catalog row — first color/size, matches the Facebook feed. */
export function defaultCatalogContentId(product: CatalogProduct): string {
  const colors = [...(product.colors ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id,
  )
  const color = colors[0]
  if (!color) return String(product.id)
  return metaCatalogContentId(product.id, color.id, color.sizes?.[0]?.size)
}
