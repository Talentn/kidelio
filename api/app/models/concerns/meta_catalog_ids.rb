# Meta catalog content IDs — must match FacebookCatFeedController and frontend metaCatalogId.ts
module MetaCatalogIds
  module_function

  def content_id(product_id:, color_id: nil, size_label: nil)
    parts = [product_id.to_s]
    if color_id.present?
      parts << "c#{color_id}"
      slug = size_label.to_s.parameterize.presence
      parts << slug if slug
    end
    parts.join("-")
  end

  def content_id_for_order_item(item)
    color_id = nil
    if item.product_id.present? && item.color_label.present?
      color_id = ProductColor.joins(:product)
        .where(products: { id: item.product_id }, name: item.color_label)
        .pick(:id)
    end

    content_id(
      product_id: item.product_id,
      color_id: color_id,
      size_label: item.size_label
    )
  end

  # First catalog row for a product — matches the default color/size in the feed.
  def default_content_id_for_product(product)
    colors = product.colors.sort_by { |c| [c.position || 0, c.id] }
    color = colors.first
    return product.id.to_s unless color

    size_rec = color.sizes.min_by { |s| [s.position || 0, s.size.to_s] }
    content_id(
      product_id: product.id,
      color_id: color.id,
      size_label: size_rec&.size
    )
  end
end
