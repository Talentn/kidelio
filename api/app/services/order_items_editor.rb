# Admin edits of an order's line items (add / change quantity / remove) with
# stock adjustments and totals recomputation. The stored promo discount is kept
# (clamped to the new subtotal) — it is never recalculated.
class OrderItemsEditor
  class Error < StandardError; end

  LOCKED_STATUSES = %w[delivered cancelled refunded].freeze

  def initialize(order)
    @order = order
  end

  def add_item(product_id:, color_label: nil, size_label: nil, quantity: 1)
    ensure_editable!
    qty = quantity.to_i
    raise Error, "Quantité invalide" if qty < 1

    product = Product.includes(colors: :sizes).find_by(id: product_id)
    raise Error, "Produit introuvable" unless product

    color_label = color_label.presence
    size_label = size_label.presence
    color = VariantStock.resolve_color(product, color_label)
    size_record = VariantStock.resolve_size(color, size_label)
    available = VariantStock.available(product, color, size_record, size_label)
    raise Error, "Stock insuffisant pour #{product.name} (disponible : #{available})" if available < qty

    Order.transaction do
      existing = @order.order_items.detect do |i|
        i.product_id == product.id &&
          i.color_label.to_s == color_label.to_s &&
          i.size_label.to_s == size_label.to_s
      end

      if existing
        existing.update!(quantity: existing.quantity + qty)
      else
        @order.order_items.create!(
          product: product,
          product_name: product.name,
          product_slug: product.slug,
          unit_price: product.effective_price,
          quantity: qty,
          size_label: size_label,
          color_label: color_label
        )
      end

      VariantStock.decrement!(product, color, size_record, qty)
      recalculate!
    end
    @order
  end

  def update_quantity(item_id, quantity)
    ensure_editable!
    item = @order.order_items.find(item_id)
    qty = quantity.to_i
    raise Error, "Quantité invalide" if qty < 1

    delta = qty - item.quantity
    return @order if delta.zero?

    product = item.product
    Order.transaction do
      if delta.positive?
        raise Error, "Produit indisponible" unless product

        color = VariantStock.resolve_color(product, item.color_label)
        size_record = VariantStock.resolve_size(color, item.size_label)
        available = VariantStock.available(product, color, size_record, item.size_label)
        raise Error, "Stock insuffisant (disponible : #{available})" if available < delta

        VariantStock.decrement!(product, color, size_record, delta)
      elsif product
        color = VariantStock.resolve_color(product, item.color_label)
        size_record = VariantStock.resolve_size(color, item.size_label)
        VariantStock.restore!(product, color, size_record, -delta)
      end

      item.update!(quantity: qty)
      recalculate!
    end
    @order
  end

  def remove_item(item_id)
    ensure_editable!
    item = @order.order_items.find(item_id)
    if @order.order_items.where.not(id: item.id).none?
      raise Error, "Impossible de retirer le dernier article — supprimez plutôt la commande"
    end

    product = item.product
    Order.transaction do
      if product
        color = VariantStock.resolve_color(product, item.color_label)
        size_record = VariantStock.resolve_size(color, item.size_label)
        VariantStock.restore!(product, color, size_record, item.quantity)
      end

      item.destroy!
      recalculate!
    end
    @order
  end

  private

  def ensure_editable!
    return unless LOCKED_STATUSES.include?(@order.status)

    raise Error, "Commande #{@order.status == 'delivered' ? 'livrée' : 'annulée'} — articles non modifiables"
  end

  # Keeps the promo discount (clamped) and the wallet amount already debited;
  # recomputes subtotal, shipping (free-shipping rule on the post-remise
  # amount, like checkout) and total.
  def recalculate!
    items = @order.order_items.reload
    subtotal = items.sum { |i| i.unit_price.to_d * i.quantity }
    discount = [ @order.discount_amount.to_d, subtotal ].min
    wallet = @order.wallet_amount.to_d
    shipping = Order.calculate_shipping(subtotal - discount)
    total = subtotal - discount - wallet + shipping

    if total.negative?
      raise Error, "Total négatif après modification — le crédit boutique utilisé dépasse le montant de la commande"
    end

    @order.update!(
      subtotal: subtotal,
      discount_amount: discount,
      shipping_cost: shipping,
      total: total
    )
  end
end
