module Api
  module Admin
    class ActivityLogsController < BaseController
      def index
        scope = ActivityLog.includes(:user).order(created_at: :desc)
        scope = scope.where(entity_type: params[:entity_type]) if params[:entity_type].present?
        # Use :event — :action is always "index" (Rails route action name)
        scope = scope.where(action: params[:event]) if params[:event].present?
        scope = scope.limit(params.fetch(:limit, 500).to_i.clamp(1, 1000))

        render json: {
          logs: scope.map do |log|
            {
              id: log.id,
              action: log.action,
              entity_type: log.entity_type,
              entity_id: log.entity_id,
              entity_name: log.entity_name,
              changes: log.diff,
              ip_address: log.ip_address,
              user_agent: log.user_agent,
              created_at: log.created_at,
              user: log.user&.slice(:id, :name, :email, :role)
            }
          end
        }
      end
    end
  end
end
