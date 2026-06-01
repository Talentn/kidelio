class ApplicationController < ActionController::Base
  include HtmlAuthentication

  protect_from_forgery with: :exception
  skip_before_action :verify_authenticity_token, if: -> { request.path.start_with?("/api") }

  before_action :set_current_request
  before_action :authenticate_optional_user

  helper_method :current_user, :cart_count

  def current_user
    Current.user
  end

  def cart_count
    CartManager.new(session).count
  end

  private

  def set_current_request
    Current.request = request
  end

  def authenticate_optional_user
    Current.user = session_user
  end

  def session_user
    return @session_user if defined?(@session_user)

    @session_user = User.find_by(id: session[:user_id]) if session[:user_id]
  end

  def require_user!
    return if Current.user

    render json: { error: "Connexion requise" }, status: :unauthorized
  end

  def require_staff!
    require_user!
    return if performed?
    return if Current.user.staff?

    render json: { error: "Accès refusé" }, status: :forbidden
  end

  def require_admin!
    require_user!
    return if performed?
    return if Current.user.admin?

    render json: { error: "Admin requis" }, status: :forbidden
  end

  def sign_in(user)
    session[:user_id] = user.id
    Current.user = user
    ActivityLogger.log_auth("LOGIN", user)
  end

  def sign_out
    if Current.user
      ActivityLogger.log_auth("LOGOUT", Current.user)
    end
    reset_session
    Current.user = nil
  end

  def json_image_url(attachment)
    return nil if attachment.nil?

    # Attachment can be either an ActiveStorage::Attached::* proxy (has_one / has_many)
    # or an individual ActiveStorage::Attachment record (when iterating has_many_attached).
    if attachment.respond_to?(:attached?)
      # Proxy object — check whether anything is attached before calling rails_blob_path.
      return nil unless attachment.attached?
    end

    # Relative path so the Vite dev proxy (:3001) and the admin proxy (:3002)
    # can both load images directly from Rails (:3000).
    rails_blob_path(attachment, only_path: true)
  end
end
