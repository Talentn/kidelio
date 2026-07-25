module Api
  module Admin
    # Web Push device registration + per-event preferences for staff.
    # Not listed in SECTIONS_BY_CONTROLLER — available to all staff members.
    class PushSubscriptionsController < BaseController
      # Named public_key (not "config") — ActionController defines #config internally.
      def public_key
        render json: { public_key: WebPushConfig.public_key }
      end

      def status
        sub = find_subscription
        if sub
          render json: { subscribed: true, prefs: prefs_json(sub) }
        else
          render json: { subscribed: false }
        end
      end

      def subscribe
        sub = PushSubscription.find_or_initialize_by(endpoint: params[:endpoint].to_s)
        sub.p256dh = params[:p256dh] if params[:p256dh].present?
        sub.auth = params[:auth] if params[:auth].present?
        sub.user_id = Current.user.id
        PushSubscription::EVENT_FLAGS.each_value do |flag|
          next if params[flag].nil?

          sub[flag] = ActiveModel::Type::Boolean.new.cast(params[flag])
        end

        if sub.save
          render json: { ok: true, prefs: prefs_json(sub) }
        else
          render json: { error: sub.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      def unsubscribe
        find_subscription&.destroy
        render json: { ok: true }
      end

      def test
        sub = find_subscription
        return render json: { error: "Cet appareil n'est pas abonné" }, status: :not_found unless sub

        WebPush.payload_send(
          message: {
            title: "Notification de test",
            body: "Les notifications Kidelio fonctionnent sur cet appareil.",
            url: "/admin/notifications",
            tag: "kidelio-test",
            icon: "/android-chrome-192x192.png"
          }.to_json,
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          ttl: 60,
          vapid: WebPushConfig.vapid_options
        )
        render json: { ok: true }
      rescue WebPush::ResponseError => e
        render json: { error: "Envoi impossible : #{e.message}" }, status: :bad_gateway
      end

      private

      def find_subscription
        endpoint = params[:endpoint].to_s
        return nil if endpoint.blank?

        PushSubscription.find_by(endpoint: endpoint)
      end

      def prefs_json(sub)
        sub.slice(:notify_orders, :notify_chat, :notify_messages)
      end
    end
  end
end
