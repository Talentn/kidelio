module Api
  module V1
    class ConsentController < BaseController
      skip_before_action :verify_authenticity_token

      COOKIE_NAME = :kids_shop_consent

      def show
        render json: { consent: cookies[COOKIE_NAME] }
      end

      def update
        level = params[:level]
        unless %w[essential all].include?(level)
          return render json: { error: "Niveau invalide" }, status: :unprocessable_entity
        end

        cookies[COOKIE_NAME] = {
          value: level,
          expires: 1.year.from_now,
          same_site: :lax,
          secure: Rails.env.production?,
          httponly: false
        }

        render json: { consent: level }
      end
    end
  end
end
