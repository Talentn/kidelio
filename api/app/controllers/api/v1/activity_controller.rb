module Api
  module V1
    class ActivityController < BaseController
      skip_before_action :verify_authenticity_token

      def create
        sid = live_session_id
        if sid.present? && activity_params[:event_type].present?
          ClientActivityJob.perform_later(
            event_type: activity_params[:event_type],
            session_id: sid,
            user_id: Current.user&.id,
            path: activity_params[:path],
            product_id: activity_params[:product_id],
            product_name: activity_params[:product_name],
            metadata: (activity_params[:metadata] || {}).to_h,
            ip_address: request.remote_ip,
            user_agent: request.user_agent
          )
        end
        head :no_content
      end

      private

      def activity_params
        params.permit(:event_type, :path, :product_id, :product_name, metadata: {})
      end

      def live_session_id
        request.get_header("HTTP_X_SESSION_ID").presence || session.id.to_s
      end
    end
  end
end
