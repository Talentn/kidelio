module Store
  class CartController < BaseController
    def show
      @lines = cart.lines
      @subtotal = cart.subtotal
      @shipping = Order.calculate_shipping(@subtotal)
    end

    def create
      product = Product.active.find(params[:product_id])
      cart.add(product, quantity: params[:quantity].to_i.clamp(1, 99),
        size_label: params[:size_label], color_label: params[:color_label])
      redirect_to store_cart_path, notice: "#{product.name} ajouté au panier."
    rescue ArgumentError => e
      redirect_to store_product_path(product.slug), alert: e.message
    end

    def update
      cart.update_quantity(params[:product_id], params[:quantity].to_i)
      redirect_to store_cart_path, notice: "Panier mis à jour."
    rescue ArgumentError => e
      redirect_to store_cart_path, alert: e.message
    end

    def destroy
      cart.remove(params[:product_id])
      redirect_to store_cart_path, notice: "Article retiré."
    end
  end
end
