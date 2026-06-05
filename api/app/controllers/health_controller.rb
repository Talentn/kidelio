# Lightweight health endpoint for Docker/nginx — no session, no DB required.
class HealthController < ActionController::Base
  def show
    render json: { status: "ok", time: Time.current.iso8601 }
  end
end
