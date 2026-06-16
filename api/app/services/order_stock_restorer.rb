# Restores inventory decremented by OrderCreator (mirror of decrement_stock! logic).
class OrderStockRestorer
  def self.restore!(order)
    return if order.stock_restored?

    order.order_items.includes(product: { colors: :sizes }).find_each do |item|
      restore_line!(item)
    end

    order.update!(stock_restored: true)
  end

  def self.restore_line!(item)
    product = item.product
    return unless product

    qty = item.quantity
    color = resolve_color(product, item.color_label)
    size_record = resolve_size(color, item.size_label)

    if size_record
      size_record.update!(stock: size_record.stock + qty)
    elsif color&.sizes&.any?
      # Exact size breakdown isn't stored — add back to the first size row for this color.
      first = color.sizes.ordered.first
      first&.update!(stock: first.stock + qty)
    else
      product.update!(stock: product.stock + qty)
    end
  end

  def self.resolve_color(product, color_label)
    return nil if color_label.blank?

    product.colors.find { |c| c.name == color_label }
  end

  def self.resolve_size(color, size_label)
    return nil unless color && size_label.present?

    color.sizes.find { |s| s.size == size_label }
  end

  private_class_method :restore_line!, :resolve_color, :resolve_size
end
