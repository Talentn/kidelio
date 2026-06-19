module Api
  module Admin
    class CartLiveEventsController < BaseController
      def index
        limit = params.fetch(:limit, 150).to_i.clamp(1, 500)
        events = CartLiveEvent.includes(:user).order(created_at: :desc).limit(limit)

        render json: {
          events: events.map { |e| serialize(e) }
        }
      end

      private

      def serialize(e)
        {
          id: e.id.to_s,
          user_id: e.user_id,
          user_name: e.user&.name,
          session_id: e.session_id,
          action: e.action,
          product_id: e.product_id,
          product_name: e.product_name,
          quantity: e.quantity,
          price: e.price.to_f,
          color_id: e.color_id,
          color_label: e.color_label,
          size_label: e.size_label,
          created_at: e.created_at.iso8601(3)
        }
      end
    end
  end
end
