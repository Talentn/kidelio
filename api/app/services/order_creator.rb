class OrderCreator
  class Error < StandardError; end

  def initialize(params, user: nil)
    @params = params
    @user = user
  end

  def call
    items = @params[:items] || []
    raise Error, "Panier vide" if items.empty?

    products = Product.where(id: items.map { |i| i[:product_id] }).index_by(&:id)
    subtotal = 0.to_d
    line_items = []

    items.each do |item|
      product = products[item[:product_id].to_i]
      raise Error, "Produit introuvable" unless product&.active?
      qty = item[:quantity].to_i
      raise Error, "Quantité invalide" if qty < 1
      raise Error, "Stock insuffisant pour #{product.name}" if product.stock < qty

      unit = product.effective_price
      subtotal += unit * qty
      line_items << {
        product: product,
        product_name: product.name,
        product_slug: product.slug,
        unit_price: unit,
        quantity: qty,
        size_label: item[:size_label],
        color_label: item[:color_label]
      }
    end

    discount = 0.to_d
    promo_code_str = nil
    if @params[:promo_code].present?
      promo = PromoCode.active.find_by("LOWER(code) = ?", @params[:promo_code].downcase)
      raise Error, "Code promo invalide" unless promo&.usable?
      if promo.min_order_amount.present? && subtotal < promo.min_order_amount
        raise Error, "Montant minimum non atteint"
      end
      discount = promo.apply_to(subtotal)
      promo_code_str = promo.code
    end

    shipping = Order.calculate_shipping(subtotal)
    total = subtotal - discount + shipping

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
        total: total,
        promo_code: promo_code_str,
        payment_method: @params[:payment_method] || "cash",
        notes: @params[:notes]
      )

      line_items.each do |li|
        product = li[:product]
        product.update!(stock: product.stock - li[:quantity])
        order.order_items.create!(li.except(:product))
      end

      if promo_code_str
        PromoCode.find_by(code: promo_code_str)&.increment!(:used_count)
      end

      order
    end
  end
end
