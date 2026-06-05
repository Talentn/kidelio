module Api
  module V1
    class ConfigController < BaseController
      def show
        render json: {
          store: "Kids Shop",
          currency: "TND",
          api_version: 1,
          shipping_cost: Order::SHIPPING_COST,
          free_shipping_threshold: Order::FREE_SHIPPING_THRESHOLD,
          authenticated: Current.user.present?,
          user: Current.user ? {
            id: Current.user.id,
            name: Current.user.name,
            role: Current.user.role
          } : nil,
          communication: "json_rest",
          frontend: "react",
          google_auth: (ENV["GOOGLE_CLIENT_ID"].presence || Rails.application.credentials.dig(:google_client_id)).present? &&
                       (ENV["GOOGLE_CLIENT_SECRET"].presence || Rails.application.credentials.dig(:google_client_secret)).present?,
          urls: {
            site: ENV.fetch("SITE_URL", "http://localhost:3000"),
            admin: ENV.fetch("SITE_URL", "http://localhost:3000") + "/admin",
            api: ENV.fetch("API_URL", "http://localhost:3001")
          }
        }
      end
    end
  end
end
