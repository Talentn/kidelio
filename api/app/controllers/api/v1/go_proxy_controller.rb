module Api
  module V1
    # Forwards REST calls to go-service. WebSocket upgrades use GoWebSocketProxyMiddleware.
    class GoProxyController < BaseController
      def create_chat_room
        relay("/chat/rooms")
      end

      def chat_room_messages
        relay("/chat/rooms/#{params[:room_id]}/messages")
      end

      def chat_admin_queue
        relay("/chat/admin/queue")
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

      def cart_admin_events
        relay("/cart/admin/events")
      end

      def favorites_admin_events
        relay("/favorites/admin/events")
      end

      private

      def relay(go_path)
        res = GoServiceClient.forward(
          method: request.method,
          path: go_path,
          body: request.raw_post.presence,
          rack_request: request
        )
        response.headers["Content-Type"] = res["Content-Type"] if res["Content-Type"]
        render plain: res.body, status: res.code.to_i
      rescue Errno::ECONNREFUSED, SocketError
        render json: { error: "go-service unavailable" }, status: :service_unavailable
      end
    end
  end
end
