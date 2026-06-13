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

  # Bumpable cache version used to invalidate all v1 public caches at once.
  # SolidCache doesn't support delete_matched, so we namespace cache keys with
  # this counter and increment it on admin writes instead of deleting keys.
  CACHE_VERSION_KEY = "v1/cache_version".freeze

  def catalog_cache_version
    Rails.cache.read(CACHE_VERSION_KEY).to_i
  end

  def bump_catalog_cache_version!
    Rails.cache.write(CACHE_VERSION_KEY, catalog_cache_version + 1)
  end

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

  def require_super_ops!
    require_staff!
    return if performed?

    allowed = ENV.fetch("SUPER_OPS_EMAIL", "alaghabi98@gmail.com").strip.downcase
    return if Current.user.email.to_s.strip.downcase == allowed

    render json: { error: "Accès refusé" }, status: :forbidden
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

  # Returns a raw blob URL (used for admin uploads, non-image files).
  def json_image_url(attachment)
    return nil if attachment.nil?

    if attachment.respond_to?(:attached?)
      return nil unless attachment.attached?
    end

    rails_blob_path(attachment, only_path: true)
  end

  # Returns a resized WebP variant URL for storefront images.
  # Falls back to the raw blob path if the attachment is not an image.
  #
  # size: :thumb  → 300×400  (product cards, color thumbnails)
  # size: :medium → 600×800  (product listing, category grid)
  # size: :large  → 900×1200 (product detail gallery)
  VARIANT_SIZES = {
    thumb:  [ 300, 400 ],
    medium: [ 600, 800 ],
    large:  [ 900, 1200 ],
  }.freeze

  def json_variant_url(attachment, size: :medium)
    return nil if attachment.nil?

    if attachment.respond_to?(:attached?)
      return nil unless attachment.attached?
    end

    # Only process image content types
    content_type = attachment.respond_to?(:content_type) ? attachment.content_type : ""
    unless content_type.to_s.start_with?("image/")
      return rails_blob_path(attachment, only_path: true)
    end

    dims = VARIANT_SIZES.fetch(size, VARIANT_SIZES[:medium])
    variant = attachment.variant(
      resize_to_limit: dims,
      format: :webp,
      saver: { quality: 82 }
    )
    rails_representation_path(variant, only_path: true)
  rescue StandardError
    # If variant processing fails (unsupported format, etc.), serve the original
    rails_blob_path(attachment, only_path: true)
  end
end
