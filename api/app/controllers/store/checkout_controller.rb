module Store
  class CheckoutController < BaseController
    before_action :ensure_cart_not_empty, only: %i[new create]

    def new
      @lines = cart.lines
      @subtotal = cart.subtotal
      @shipping = Order.calculate_shipping(@subtotal)
      @promo_code = session[:promo_code]
      @discount = session[:discount].to_d
    end

    def create
      order = OrderCreator.new(checkout_params.merge(items: cart_items_payload), user: Current.user).call
      cart.clear
      session.delete(:promo_code)
      session.delete(:discount)
      ProcessOrderJob.perform_later(order.id)
      redirect_to store_order_path(order.order_number), notice: "Commande confirmée !"
    rescue OrderCreator::Error => e
      @lines = cart.lines
      @subtotal = cart.subtotal
      @shipping = Order.calculate_shipping(@subtotal)
      @discount = session[:discount].to_d
      flash.now[:alert] = e.message
      render :new, status: :unprocessable_entity
    end

    def apply_promo
      promo = PromoCode.active.find_by("LOWER(code) = ?", params[:code].to_s.downcase)
      subtotal = cart.subtotal
      if promo&.usable? && (promo.min_order_amount.nil? || subtotal >= promo.min_order_amount)
        session[:promo_code] = promo.code
        session[:discount] = promo.apply_to(subtotal)
        redirect_to new_store_checkout_path, notice: "Code promo appliqué."
      else
        redirect_to new_store_checkout_path, alert: "Code promo invalide."
      end
    end

    private

    def ensure_cart_not_empty
      redirect_to store_cart_path, alert: "Votre panier est vide." if cart.items.empty?
    end

    def checkout_params
      params.permit(
        :guest_name, :guest_phone, :guest_email,
        :shipping_governorate, :shipping_delegation, :shipping_address,
        :shipping_postal_code, :notes
      ).merge(
        promo_code: session[:promo_code],
        payment_method: "cash"
      )
    end

    def cart_items_payload
      cart.items.map do |line|
        {
          product_id: line.product_id,
          quantity: line.quantity,
          size_label: line.size_label,
          color_label: line.color_label
        }
      end
    end
  end
end
