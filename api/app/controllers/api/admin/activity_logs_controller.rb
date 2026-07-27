module Api
  module Admin
    class ActivityLogsController < BaseController
      def index
        scope = ActivityLog.includes(:user).order(created_at: :desc)
        scope = scope.where(entity_type: params[:entity_type]) if params[:entity_type].present?
        # Use :event — :action is always "index" (Rails route action name)
        scope = scope.where(action: params[:event]) if params[:event].present?

        from_date = parse_date(params[:from])
        to_date = parse_date(params[:to])
        from_date, to_date = to_date, from_date if from_date && to_date && from_date > to_date
        scope = scope.where("created_at >= ?", from_date.beginning_of_day) if from_date
        scope = scope.where("created_at <= ?", to_date.end_of_day) if to_date

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

      private

      def parse_date(value)
        return nil if value.blank?
        Date.iso8601(value.to_s)
      rescue ArgumentError
        nil
      end
    end
  end
end
