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
        product = li[:product]
        product.update!(stock: product.stock - li[:quantity])
        order.order_items.create!(li.except(:product))
      end

      if promo_code_str
        PromoCode.find_by(code: promo_code_str)&.increment!(:used_count)
      end

      @user.decrement!(:wallet_balance, wallet_used) if @user && wallet_used.positive?

      order
    end
  end

  private

  def wallet_amount_to_apply(subtotal, promo_discount)
    return 0.to_d unless @user
    return 0.to_d unless @params[:use_wallet].present? &&
      ActiveModel::Type::Boolean.new.cast(@params[:use_wallet])

    available = @user.wallet_balance.to_d
    payable = subtotal - promo_discount
    [available, payable].min.clamp(0..)
  end
end
