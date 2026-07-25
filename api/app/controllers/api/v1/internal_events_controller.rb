module Api
  module V1
    # Server-to-server events from the Go realtime service (chat), authenticated
    # with the same shared secret Go already trusts for staff headers.
    class InternalEventsController < ApplicationController
      skip_before_action :verify_authenticity_token
      before_action :require_internal_secret!

      # At most one push per chat room in this window — a busy conversation
      # should not fire a notification for every single message.
      CHAT_THROTTLE = 2.minutes

      def create
        case params[:event].to_s
        when "chat_room"
          notify_chat(
            title: "Nouveau chat en attente",
            body: "#{sender_name} attend une réponse",
            room_id: params[:room_id]
          )
        when "chat_message"
          notify_chat(
            title: "Nouveau message chat",
            body: "#{sender_name} : #{params[:preview].to_s.truncate(120)}",
            room_id: params[:room_id]
          )
        end
        render json: { ok: true }
      end

      private

      def sender_name
        params[:name].presence || "Un client"
      end

      def notify_chat(title:, body:, room_id:)
        key = "web_push/chat/#{room_id.presence || 'unknown'}"
        return if Rails.cache.exist?(key)

        Rails.cache.write(key, true, expires_in: CHAT_THROTTLE)
        SendWebPushJob.perform_later("chat", title: title, body: body, url: "/admin/chat", tag: "kidelio-chat")
      end

      def require_internal_secret!
        secret = ENV["GO_INTERNAL_SECRET"].presence || (Rails.env.development? ? "dev-internal" : nil)
        provided = request.headers["X-Kidelio-Internal"].to_s
        return if secret.present? && provided.present? &&
                  ActiveSupport::SecurityUtils.secure_compare(provided, secret)

        head :unauthorized
      end
    end
  end
end
