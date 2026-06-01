# frozen_string_literal: true

module Users
  class OmniauthCallbacksController < Devise::OmniauthCallbacksController
    skip_before_action :verify_authenticity_token, raise: false

    def google_oauth2
      @user = User.from_omniauth(request.env["omniauth.auth"])
      establish_session(@user)
      redirect_to oauth_redirect_url(@user), allow_other_host: true
    rescue StandardError => e
      Rails.logger.error("[oauth] #{e.class}: #{e.message}")
      redirect_to "#{frontend_base}/connexion?error=oauth", allow_other_host: true
    end

    def failure
      redirect_to "#{frontend_base}/connexion?error=oauth", allow_other_host: true
    end

    private

    def establish_session(user)
      session[:user_id] = user.id
      Current.user = user
      ActivityLogger.log_auth("LOGIN", user)
    end

    def frontend_base
      ENV.fetch("FRONTEND_URL", "http://localhost:3000")
    end

    def oauth_redirect_url(user)
      base = frontend_base
      user.staff? ? "#{base}/admin" : "#{base}/compte"
    end
  end
end
