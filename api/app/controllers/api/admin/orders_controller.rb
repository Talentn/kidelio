module Api
  module Admin
    class OrdersController < BaseController
      include OrderTrackingJson

      CANCELLED_STATUSES = %w[cancelled refunded].freeze

      def index
        orders = Order.includes(:order_items, :user).order(created_at: :desc).limit(200)
        render json: { orders: orders.map { |o| admin_order_json(o) } }
      end

      def show
        order = Order
          .includes(:user, order_items: [ :product, { product: [ :colors, { images_attachments: :blob } ] } ])
          .find(params[:id])
        render json: { order: admin_order_json(order, detail: true) }
      end

      def update
        order = Order.find(params[:id])
        previous_status = order.status

        if order.update(order_params)
          handle_status_change!(order, previous_status)
          render json: { order: admin_order_json(order.reload) }
        else
          render json: { errors: order.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def destroy
        order = Order.find(params[:id])
        OrderDestroyer.new(order).call
        head :no_content
      rescue OrderDestroyer::Error => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      end

      private

      def order_params
        params.permit(:status, :notes)
      end

      def handle_status_change!(order, previous_status)
        return if previous_status == order.status

        handle_loyalty_status_change!(order, previous_status)
        handle_cancel_side_effects!(order, previous_status)
      end

      def handle_loyalty_status_change!(order, previous_status)
        if CANCELLED_STATUSES.include?(order.status) && CANCELLED_STATUSES.exclude?(previous_status)
          refund_wallet!(order) if order.wallet_amount.to_d.positive?
        end

        if order.status == LoyaltyProgram::COUNTED_STATUS && previous_status != LoyaltyProgram::COUNTED_STATUS
          LoyaltyProgram.record_order!(order)
        elsif previous_status == LoyaltyProgram::COUNTED_STATUS && order.status != LoyaltyProgram::COUNTED_STATUS
          LoyaltyProgram.reverse_order!(order)
        end
      end

      def handle_cancel_side_effects!(order, previous_status)
        return unless CANCELLED_STATUSES.include?(order.status)
        return if CANCELLED_STATUSES.include?(previous_status)

        OrderStockRestorer.restore!(order)
        reverse_promo!(order)
      end

      def refund_wallet!(order)
        return unless order.user

        order.user.increment!(:wallet_balance, order.wallet_amount.to_d)
      end

      def reverse_promo!(order)
        return if order.promo_code.blank?

        promo = PromoCode.find_by(code: order.promo_code)
        return unless promo && promo.used_count.positive?

        promo.decrement!(:used_count)
      end

      def admin_order_json(order, detail: false)
        json = {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          status_label: OrderTrackingJson::STATUS_LABELS[order.status] || "Statut inconnu",
          guest_name: order.guest_name,
          guest_phone: order.guest_phone,
          guest_email: order.guest_email,
          subtotal: order.subtotal,
          shipping_cost: order.shipping_cost,
          discount_amount: order.discount_amount,
          total: order.total,
          payment_method: order.payment_method,
          created_at: order.created_at,
          user: order.user&.slice(:id, :name, :email)
        }
        if detail
          json.merge!(
            shipping_governorate: order.shipping_governorate,
            shipping_delegation: order.shipping_delegation,
            shipping_address: order.shipping_address,
            items: order.order_items.map { |i| order_item_json(i) }
          )
        end
        json
      end

      def order_item_json(item)
        product = item.product
        item.slice(:product_name, :quantity, :unit_price, :size_label, :color_label).merge(
          product_slug: item.product_slug || product&.slug,
          product_available: product.present? && product.active,
          image_url: product ? json_variant_url(product.listing_image_attachments.first, size: :thumb) : nil
        )
      end
    end
  end
end
