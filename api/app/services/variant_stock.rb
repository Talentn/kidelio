# Stock helpers for a product variant (color/size), mirroring the behaviour of
# OrderCreator#decrement_stock! and OrderStockRestorer so admin order edits
# move inventory exactly like checkout and cancellations do.
module VariantStock
  module_function

  def resolve_color(product, color_label)
    return nil if color_label.blank?

    product.colors.find { |c| c.name == color_label }
  end

  def resolve_size(color, size_label)
    return nil unless color && size_label.present?

    color.sizes.find { |s| s.size == size_label }
  end

  def available(product, color, size_record, size_label = nil)
    if size_label.present?
      return size_record.stock if size_record

      return 0
    end
    if color
      total = color.total_stock
      return total unless total.nil?
    end
    product.stock
  end

  def decrement!(product, color, size_record, qty)
    if size_record
      size_record.update!(stock: [ size_record.stock - qty, 0 ].max)
    elsif color&.sizes&.any?
      remaining = qty
      color.sizes.ordered.each do |s|
        break if remaining <= 0

        take = [ s.stock, remaining ].min
        s.update!(stock: s.stock - take) if take.positive?
        remaining -= take
      end
    else
      product.update!(stock: [ product.stock - qty, 0 ].max)
    end
  end

  def restore!(product, color, size_record, qty)
    if size_record
      size_record.update!(stock: size_record.stock + qty)
    elsif color&.sizes&.any?
      first = color.sizes.ordered.first
      first&.update!(stock: first.stock + qty)
    else
      product.update!(stock: product.stock + qty)
    end
  end
end
