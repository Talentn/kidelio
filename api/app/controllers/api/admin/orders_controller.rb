module Api
  module Admin
    class OrdersController < BaseController
      include OrderTrackingJson
      def index
        orders = Order.includes(:order_items, :user).order(created_at: :desc).limit(200)
        render json: { orders: orders.map { |o| admin_order_json(o) } }
      end

      def show
        order = Order.includes(:order_items, :user).find(params[:id])
        render json: { order: admin_order_json(order, detail: true) }
      end

      def update
        order = Order.find(params[:id])
        previous_status = order.status

        if order.update(order_params)
          handle_loyalty_status_change!(order, previous_status)
          render json: { order: admin_order_json(order.reload) }
        else
          render json: { errors: order.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def order_params
        params.permit(:status, :notes)
      end

      def handle_loyalty_status_change!(order, previous_status)
        return if previous_status == order.status

        cancelled = %w[cancelled refunded]
        if cancelled.include?(order.status) && cancelled.exclude?(previous_status)
          LoyaltyProgram.reverse_order!(order)
          refund_wallet!(order) if order.wallet_amount.to_d.positive?
        elsif cancelled.include?(previous_status) && cancelled.exclude?(order.status)
          LoyaltyProgram.record_order!(order) unless order.loyalty_counted?
        end
      end

      def refund_wallet!(order)
        return unless order.user

        order.user.increment!(:wallet_balance, order.wallet_amount.to_d)
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
            items: order.order_items.map do |i|
              i.slice(:product_name, :quantity, :unit_price, :size_label, :color_label)
            end
          )
        end
        json
      end
    end
  end
end
