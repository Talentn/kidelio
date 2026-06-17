/** Matches FacebookCatFeedController#variant_catalog_id (Rails parameterize). */
function slugSize(label: string): string {
  return (
    label
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
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
