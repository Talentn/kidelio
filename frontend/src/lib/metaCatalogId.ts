/**
 * Meta catalog / Pixel content_id for a product variant.
 *
 * MUST stay in sync with FacebookCatFeedController#variant_catalog_id, which
 * emits color-level IDs only: `{productId}` (no colors) or `{productId}-c{colorId}`.
 * The catalog has no per-size rows, so the size must NOT be part of the id —
 * otherwise Pixel events reference content_ids that don't exist in the catalog
 * and Meta can't match them (breaking Shops / dynamic ads).
 *
 * `sizeLabel` is accepted for call-site compatibility but intentionally unused.
 */
export function metaCatalogContentId(
  productId: number,
  colorId?: number | null,
  _sizeLabel?: string | null,
): string {
  return colorId ? `${productId}-c${colorId}` : String(productId)
}

type CatalogProduct = {
  id: number
  colors?: Array<{ id: number; position?: number }>
}

/** Default catalog row — first color, matches the Facebook feed. */
export function defaultCatalogContentId(product: CatalogProduct): string {
  const colors = [...(product.colors ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id,
  )
  const color = colors[0]
  return color ? metaCatalogContentId(product.id, color.id) : String(product.id)
}
