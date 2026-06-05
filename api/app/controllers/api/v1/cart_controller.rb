module Api
  module V1
    class CartController < BaseController
      include CartAccess
      skip_before_action :verify_authenticity_token

      def show
        render json: cart_json
      end

      def add_item
        product  = Product.active.includes(colors: :sizes).find(params[:product_id])
        quantity = params[:quantity].to_i.clamp(1, 99)
        cart.add(
          product,
          quantity:    quantity,
          size_label:  params[:size_label],
          color_label: params[:color_label],
          color_id:    params[:color_id]
        )
        MetaPixelEventJob.perform_later(
          :add_to_cart,
          product_id: product.id,
          quantity:   quantity,
          price:      product.effective_price.to_f,
        )
        render json: cart_json
      rescue ArgumentError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      def update_item
        cart.update_quantity(
          params[:product_id],
          params[:quantity].to_i,
          color_label: params[:color_label],
          size_label:  params[:size_label],
          color_id:    params[:color_id]
        )
        render json: cart_json
      rescue ArgumentError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      def remove_item
        cart.remove(
          params[:product_id],
          color_label: params[:color_label],
          size_label:  params[:size_label],
          color_id:    params[:color_id]
        )
        render json: cart_json
      end

      def destroy
        cart.clear
        render json: cart_json
      end

      private

      def cart_json
        lines = cart.lines
        {
          items: lines.map do |line|
            p = line[:product]
            {
              product_id: p.id,
              name: p.name,
              slug: p.slug,
              unit_price: line[:unit_price],
              quantity: line[:quantity],
              subtotal: line[:subtotal],
              image_url: cart_thumbnail(p, line[:color_label], line[:color_id]),
              size_label: line[:size_label],
              color_label: line[:color_label],
              color_id: line[:color_id]
            }
          end,
          subtotal: cart.subtotal,
          count: cart.count,
          shipping: Order.calculate_shipping(cart.subtotal),
          free_shipping_threshold: Order::FREE_SHIPPING_THRESHOLD
        }
      end

      # Prefer the selected color's first image; fall back to the product gallery.
      def cart_thumbnail(product, color_label, color_id = nil)
        color = nil
        if color_id.present?
          color = product.colors.find { |c| c.id == color_id.to_i }
        elsif color_label.present?
          color = product.colors.find { |c| c.name == color_label }
        end

        if color&.images&.attached? && color.images.any?
          return json_variant_url(color.images.first, size: :thumb)
        end
        product.images.attached? ? json_variant_url(product.images.first, size: :thumb) : nil
      end
    end
  end
end
