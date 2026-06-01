module Admin
  class ActivityLogsController < BaseController
    def index
      @logs = ActivityLog.includes(:user).order(created_at: :desc).limit(150)
    end
  end
end
