module Api
  module V1
    class OrdersController < BaseController
      include OrderTrackingJson

      skip_before_action :verify_authenticity_token, only: :create

      def create
        payload = order_params.to_h.symbolize_keys
        payload[:items] = cart_items_payload if payload[:items].blank?

        if payload[:address_id].present? && Current.user
          apply_saved_address!(payload)
        end

        order = OrderCreator.new(payload, user: Current.user).call
        cart.clear

        if Current.user && payload[:save_address] != false && payload[:save_address] != "false"
          Address.upsert_from_shipping!(
            Current.user,
            full_name: order.guest_name,
            phone: order.guest_phone,
            governorate: order.shipping_governorate,
            delegation: order.shipping_delegation,
            street_address: order.shipping_address,
            postal_code: order.shipping_postal_code
          )
        end

        ProcessOrderJob.perform_later(order.id)
        MetaPixelEventJob.perform_later(:purchase, order_id: order.id)
        render json: { order: order_track_json(order, detailed: true) }, status: :created
      rescue OrderCreator::Error => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      def index
        require_user!
        return if performed?

        orders = Current.user.orders.includes(:order_items).order(created_at: :desc)
        render json: { orders: orders.map { |o| order_track_json(o, detailed: false) } }
      end

      def show
        require_user!
        return if performed?

        order = Current.user.orders.includes(:order_items).find_by!(order_number: params[:id])
        render json: { order: order_track_json(order, detailed: true) }
      end

      def track
        order = Order.includes(:order_items).find_by!(order_number: params[:order_number].to_s.upcase)
        detailed = Current.user.present? && order.user_id == Current.user.id
        render json: { order: order_track_json(order, detailed: detailed) }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Commande introuvable" }, status: :not_found
      end

      private

      def apply_saved_address!(payload)
        address = Current.user.addresses.find(payload[:address_id])
        payload[:guest_name] ||= address.full_name
        payload[:guest_phone] ||= address.phone
        payload[:shipping_governorate] = address.governorate
        payload[:shipping_delegation] = address.delegation
        payload[:shipping_address] = address.street_address
        payload[:shipping_postal_code] = address.postal_code
      end

      def order_params
        params.permit(
          :guest_name, :guest_phone, :guest_email,
          :shipping_governorate, :shipping_delegation, :shipping_address,
          :shipping_postal_code, :promo_code, :payment_method, :notes,
          :address_id, :save_address, :use_wallet,
          items: %i[product_id quantity size_label color_label]
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
end
