module Api
  module V1
    class ActivityController < BaseController
      skip_before_action :verify_authenticity_token

      def create
        ClientActivityLogger.record(
          event_type: activity_params[:event_type],
          session_id: live_session_id,
          user: Current.user,
          path: activity_params[:path],
          product_id: activity_params[:product_id],
          product_name: activity_params[:product_name],
          metadata: activity_params[:metadata] || {},
          rack_request: request
        )
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
