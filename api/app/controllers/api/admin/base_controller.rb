module Api
  module Admin
    class BaseController < ApplicationController
      include AdminParamCasting

      skip_before_action :verify_authenticity_token

      before_action :require_staff!
      before_action :require_admin_section!

      # Which admin section(s) grant access to each controller. Controllers not
      # listed here (dashboard, system_status, queues_status) are either always
      # available to staff or gated separately via require_super_ops!.
      SECTIONS_BY_CONTROLLER = {
        "statistics" => %w[statistics],
        "products" => %w[products stock],
        "product_colors" => %w[products stock],
        "product_color_sizes" => %w[products stock],
        "orders" => %w[orders],
        "product_reviews" => %w[reviews],
        "categories" => %w[categories],
        "homepage" => %w[homepage],
        "hero_sliders" => %w[homepage],
        "contact_messages" => %w[messages],
        "promo_popups" => %w[promos],
        "promo_codes" => %w[promo_codes],
        "users" => %w[users],
        "size_attributes" => %w[attributes],
        "activity_logs" => %w[activity],
        "cart_live_events" => %w[client_analytics],
        "client_analytics" => %w[client_analytics]
      }.freeze

      private

      def require_admin_section!
        return if performed?

        sections = SECTIONS_BY_CONTROLLER[controller_name]
        return if sections.nil?
        return if sections.any? { |s| Current.user.admin_section_allowed?(s) }

        render json: { error: "Section non autorisée" }, status: :forbidden
      end

      def invalidate_catalog_cache
        bump_catalog_cache_version!
      end
    end
  end
end
