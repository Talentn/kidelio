module Api
  module V1
    # Forwards REST calls to go-service. WebSocket upgrades use GoWebSocketProxyMiddleware.
    class GoProxyController < BaseController
      ADMIN_ACTIONS = %i[
        chat_admin_queue chat_admin_archives chat_admin_room chat_admin_delete
        chat_admin_join chat_admin_message chat_admin_close
        cart_admin_events favorites_admin_events tracking_admin_events
      ].freeze

      before_action :require_staff!, only: ADMIN_ACTIONS

      def create_chat_room
        relay("/chat/rooms")
      end

      def chat_room_messages
        relay("/chat/rooms/#{params[:room_id]}/messages")
      end

      def chat_room_send_message
        relay("/chat/rooms/#{params[:room_id]}/messages")
      end

      def chat_admin_queue
        relay("/chat/admin/queue")
      end

      def chat_admin_archives
        relay("/chat/admin/archives")
      end

      def chat_admin_room
        relay("/chat/admin/rooms/#{params[:room_id]}")
      end

      def chat_admin_delete
        relay("/chat/admin/rooms/#{params[:room_id]}")
      end

      def chat_admin_join
        relay("/chat/admin/rooms/#{params[:room_id]}/join")
      end

      def chat_admin_message
        relay("/chat/admin/rooms/#{params[:room_id]}/messages")
      end

      def chat_admin_close
        relay("/chat/admin/rooms/#{params[:room_id]}/close")
      end

      def cart_events
        relay("/cart/signals", read_timeout: 4)
      end

      def favorites_events
        relay("/favorites/events", read_timeout: 4)
      end

      def cart_admin_events
        relay("/cart/admin/signals")
      end

      def favorites_admin_events
        relay("/favorites/admin/events")
      end

      def tracking_events
        relay("/tracking/events", read_timeout: 4)
      end

      def tracking_admin_events
        relay("/tracking/admin/events")
      end

      private

      def relay(go_path, read_timeout: 15)
        forwarded_path = request.query_string.present? ? "#{go_path}?#{request.query_string}" : go_path
        staff = ADMIN_ACTIONS.include?(action_name.to_sym) ? Current.user : nil
        customer = (action_name == "create_chat_room" ? Current.user : nil)
        res = GoServiceClient.forward(
          method: request.method,
          path: forwarded_path,
          body: request.raw_post.presence,
          rack_request: request,
          staff: staff,
          customer: customer,
          read_timeout: read_timeout
        )
        response.headers["Content-Type"] = res["Content-Type"] if res["Content-Type"]
        render plain: res.body, status: res.code.to_i
      rescue Errno::ECONNREFUSED, SocketError, Net::OpenTimeout, Net::ReadTimeout, Timeout::Error
        render json: { error: "go-service unavailable" }, status: :service_unavailable
      end
    end
  end
end
