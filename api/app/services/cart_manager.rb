# Server-side cart — all pricing/stock rules live in Rails, not the browser.
# Lines are keyed by product_id + color_id/color_label + size_label so the same product
# in different color/size combinations appears as separate cart lines.
class CartManager
  SESSION_KEY = :cart

  Line = Data.define(:product_id, :quantity, :size_label, :color_label, :color_id)

  def initialize(session)
    @session = session
    @session[SESSION_KEY] ||= []
  end

  def items
    @session[SESSION_KEY].map do |h|
      Line.new(
        product_id:  h["product_id"].to_i,
        quantity:    h["quantity"].to_i,
        size_label:  h["size_label"],
        color_label: h["color_label"],
        color_id:    h["color_id"]&.to_i
      )
    end
  end

  def count
    items.sum(&:quantity)
  end

  def add(product, quantity: 1, size_label: nil, color_label: nil, color_id: nil)
    avail = stock_for(product, color_label, size_label, color_id: color_id)
    raise ArgumentError, "Stock insuffisant" if avail < quantity

    rows     = @session[SESSION_KEY]
    existing = rows.find { |r| variant_match?(r, product.id, color_label, size_label, color_id: color_id) }

    if existing
      new_qty = existing["quantity"] + quantity
      raise ArgumentError, "Stock insuffisant" if avail < new_qty
      existing["quantity"] = new_qty
    else
      rows << {
        "product_id"  => product.id,
        "quantity"    => quantity,
        "size_label"  => size_label,
        "color_label" => color_label,
        "color_id"    => color_id
      }
    end
  end

  def update_quantity(product_id, quantity, color_label: nil, size_label: nil, color_id: nil)
    rows = @session[SESSION_KEY]
    row  = rows.find { |r| variant_match?(r, product_id.to_i, color_label, size_label, color_id: color_id) }
    return unless row

    if quantity < 1
      rows.delete(row)
    else
      product = Product.includes(colors: :sizes).find(product_id)
      resolved_color_id = color_id || row["color_id"]
      resolved_color_label = color_label || row["color_label"]
      resolved_size_label = size_label || row["size_label"]
      avail = stock_for(product, resolved_color_label, resolved_size_label, color_id: resolved_color_id)
      raise ArgumentError, "Stock insuffisant" if avail < quantity
      row["quantity"] = quantity
    end
  end

  def remove(product_id, color_label: nil, size_label: nil, color_id: nil)
    @session[SESSION_KEY].reject! do |r|
      variant_match?(r, product_id.to_i, color_label, size_label, color_id: color_id)
    end
  end

  def clear
    @session[SESSION_KEY] = []
  end

  def lines
    return [] if items.empty?

    products = Product.where(id: items.map(&:product_id))
                      .includes(colors: :sizes)
                      .index_by(&:id)

    items.filter_map do |line|
      product = products[line.product_id]
      next unless product&.active?

      unit = product.effective_price
      {
        product:     product,
        quantity:    line.quantity,
        unit_price:  unit,
        subtotal:    unit * line.quantity,
        size_label:  line.size_label,
        color_label: line.color_label,
        color_id:    line.color_id
      }
    end
  end

  def subtotal
    lines.sum { |l| l[:subtotal] }
  end

  def to_order_items
    lines.map do |l|
      p = l[:product]
      {
        product:      p,
        product_name: p.name,
        product_slug: p.slug,
        unit_price:   l[:unit_price],
        quantity:     l[:quantity],
        size_label:   l[:size_label],
        color_label:  l[:color_label]
      }
    end
  end

  private

  def stock_for(product, color_label, size_label, color_id: nil)
    color = resolve_color(product, color_label, size_label, color_id: color_id)

    if color
      if size_label.present?
        size_record = color.sizes.find { |s| s.size == size_label }
        return size_record&.stock || 0
      end
      total = color.total_stock
      return total unless total.nil?
    end

    product.stock
  end

  def resolve_color(product, color_label, size_label, color_id: nil)
    if color_id.present?
      return product.colors.find { |c| c.id == color_id.to_i }
    end

    return nil if color_label.blank?

    if size_label.present?
      product.colors.find { |c| c.name == color_label && c.sizes.any? { |s| s.size == size_label } } ||
        product.colors.find { |c| c.name == color_label }
    else
      product.colors.find { |c| c.name == color_label }
    end
  end

  def variant_match?(row, product_id, color_label, size_label, color_id: nil)
    return false unless row["product_id"] == product_id
    return false unless row["size_label"] == size_label

    if color_id.present?
      row["color_id"].to_i == color_id.to_i
    else
      row["color_label"] == color_label
    end
  end
end
