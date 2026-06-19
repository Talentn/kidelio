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
        enqueue_live_cart_event("add", product, quantity: quantity)
        if marketing_consent?
          MetaPixelEventJob.perform_later(
            :add_to_cart,
            product_id: product.id,
            quantity:   quantity,
            price:      product.effective_price.to_f,
            color_id:   params[:color_id],
            size_label: params[:size_label],
            user_context: meta_user_context
          )
        end
        render json: cart_json
      rescue ArgumentError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      def update_item
        product = Product.find_by(id: params[:product_id])
        cart.update_quantity(
          params[:product_id],
          params[:quantity].to_i,
          color_label: params[:color_label],
          size_label:  params[:size_label],
          color_id:    params[:color_id]
        )
        enqueue_live_cart_event("update", product, quantity: params[:quantity].to_i)
        render json: cart_json
      rescue ArgumentError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      def remove_item
        product = Product.find_by(id: params[:product_id])
        cart.remove(
          params[:product_id],
          color_label: params[:color_label],
          size_label:  params[:size_label],
          color_id:    params[:color_id]
        )
        enqueue_live_cart_event("remove", product)
        render json: cart_json
      end

      def destroy
        cart.clear
        enqueue_live_cart_event("clear")
        render json: cart_json
      end

      private

      def enqueue_live_cart_event(event, product = nil, quantity: 1)
        job_args = {
          product_id: product&.id,
          product_name: product&.name,
          quantity: quantity,
          price: product&.effective_price,
          color_id: params[:color_id],
          color_label: params[:color_label],
          size_label: params[:size_label],
          session_id: live_session_id,
          user_id: Current.user&.id
        }
        if Rails.env.development?
          LiveCartEventJob.perform_now(event, **job_args)
        else
          LiveCartEventJob.perform_later(event, **job_args)
        end
      end

      def live_session_id
        request.get_header("HTTP_X_SESSION_ID").presence || session.id.to_s
      end

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
