# frozen_string_literal: true

require "devise/orm/active_record"

Devise.setup do |config|
  config.mailer_sender = "noreply@kideliowear.com"
  config.case_insensitive_keys = [:email]
  config.strip_whitespace_keys = [:email]
  config.skip_session_storage = [:http_auth]
  config.stretches = Rails.env.test? ? 1 : 12
  config.reconfirmable = false
  config.expire_all_remember_me_on_sign_out = true
  config.password_length = 8..128
  config.email_regexp = /\A[^@\s]+@[^@\s]+\z/
  config.reset_password_within = 6.hours
  config.sign_out_via = :delete
  config.navigational_formats = []
  config.responder.error_status = :unprocessable_entity
  config.responder.redirect_status = :see_other

  google_id     = ENV["GOOGLE_CLIENT_ID"].presence     || Rails.application.credentials.dig(:google_client_id).presence
  google_secret = ENV["GOOGLE_CLIENT_SECRET"].presence || Rails.application.credentials.dig(:google_client_secret).presence

  if google_id.present? && google_secret.present?
    config.omniauth :google_oauth2,
      google_id,
      google_secret,
      scope: "email,profile",
      prompt: "select_account"
  end
end
