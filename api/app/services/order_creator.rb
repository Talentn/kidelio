class OrderCreator
  class Error < StandardError; end

  def initialize(params, user: nil)
    @params = params
    @user = user
  end

  def call
    items = @params[:items] || []
    raise Error, "Panier vide" if items.empty?

    products = Product.where(id: items.map { |i| i[:product_id] })
                      .includes(colors: :sizes)
                      .index_by(&:id)
    subtotal = 0.to_d
    line_items = []

    items.each do |item|
      product = products[item[:product_id].to_i]
      raise Error, "Produit introuvable" unless product&.active?
      qty = item[:quantity].to_i
      raise Error, "Quantité invalide" if qty < 1

      color       = resolve_color(product, item[:color_label])
      size_record = resolve_size(color, item[:size_label])
      available   = available_stock(product, color, size_record, item[:size_label])
      raise Error, "Stock insuffisant pour #{product.name}" if available < qty

      unit = product.effective_price
      subtotal += unit * qty
      line_items << {
        product:      product,
        color:        color,
        size_record:  size_record,
        product_name: product.name,
        product_slug: product.slug,
        unit_price:   unit,
        quantity:     qty,
        size_label:   item[:size_label],
        color_label:  item[:color_label]
      }
    end

    discount = 0.to_d
    promo_code_str = nil
    if @params[:promo_code].present?
      promo = PromoCode.active.find_by("LOWER(code) = ?", @params[:promo_code].downcase)
      raise Error, "Code promo invalide" unless promo&.usable?(for_user: @user)
      if promo.min_order_amount.present? && subtotal < promo.min_order_amount
        raise Error, "Montant minimum non atteint"
      end
      discount = promo.apply_to(subtotal, for_user: @user)
      promo_code_str = promo.code
    end

    wallet_used = wallet_amount_to_apply(subtotal, discount)

    shipping = Order.calculate_shipping(subtotal)
    total = subtotal - discount - wallet_used + shipping
    raise Error, "Montant invalide" if total < 0

    Order.transaction do
      order = Order.create!(
        user: @user,
        guest_name: @params[:guest_name],
        guest_phone: @params[:guest_phone],
        guest_email: @params[:guest_email],
        shipping_governorate: @params[:shipping_governorate],
        shipping_delegation: @params[:shipping_delegation],
        shipping_address: @params[:shipping_address],
        shipping_postal_code: @params[:shipping_postal_code],
        subtotal: subtotal,
        shipping_cost: shipping,
        discount_amount: discount,
        wallet_amount: wallet_used,
        total: total,
        promo_code: promo_code_str,
        payment_method: @params[:payment_method] || "cash",
        notes: @params[:notes]
      )

      line_items.each do |li|
        decrement_stock!(li[:product], li[:color], li[:size_record], li[:quantity])
        order.order_items.create!(
          product:      li[:product],
          product_name: li[:product_name],
          product_slug: li[:product_slug],
          unit_price:   li[:unit_price],
          quantity:     li[:quantity],
          size_label:   li[:size_label],
          color_label:  li[:color_label]
        )
      end

      if promo_code_str
        PromoCode.find_by(code: promo_code_str)&.increment!(:used_count)
      end

      @user.decrement!(:wallet_balance, wallet_used) if @user && wallet_used.positive?

      order
    end
  end

  private

  # ── Variant resolution — mirrors CartManager so cart and checkout agree ─────

  def resolve_color(product, color_label)
    return nil if color_label.blank?
    product.colors.find { |c| c.name == color_label }
  end

  def resolve_size(color, size_label)
    return nil unless color && size_label.present?
    color.sizes.find { |s| s.size == size_label }
  end

  # Available stock for the chosen variant, falling back to the base product stock
  # when the product has no color/size breakdown (same logic as CartManager#stock_for).
  def available_stock(product, color, size_record, size_label = nil)
    if size_label.present?
      return size_record.stock if size_record
      return 0 # size requested but missing on this color — matches cart behaviour
    end
    if color
      total = color.total_stock
      return total unless total.nil?
    end
    product.stock
  end

  def decrement_stock!(product, color, size_record, qty)
    if size_record
      size_record.update!(stock: [size_record.stock - qty, 0].max)
    elsif color&.sizes&.any?
      remaining = qty
      color.sizes.ordered.each do |s|
        break if remaining <= 0
        take = [s.stock, remaining].min
        s.update!(stock: s.stock - take) if take.positive?
        remaining -= take
      end
    else
      product.update!(stock: [product.stock - qty, 0].max)
    end
  end

  def wallet_amount_to_apply(subtotal, promo_discount)
    return 0.to_d unless @user
    return 0.to_d unless @params[:use_wallet].present? &&
      ActiveModel::Type::Boolean.new.cast(@params[:use_wallet])

    available = @user.wallet_balance.to_d
    payable = subtotal - promo_discount
    [available, payable].min.clamp(0..)
  end
end
