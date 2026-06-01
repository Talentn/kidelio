module Api
  module V1
    class PromoCodesController < BaseController
      skip_before_action :verify_authenticity_token, only: :validate_code

      def validate_code
        promo = PromoCode.active.find_by("LOWER(code) = ?", params[:code].to_s.downcase)
        subtotal = params[:subtotal].to_d

        if promo&.usable? && (promo.min_order_amount.nil? || subtotal >= promo.min_order_amount)
          discount = promo.apply_to(subtotal)
          render json: {
            valid: true,
            code: promo.code,
            discount: discount,
            discount_type: promo.discount_type
          }
        else
          render json: { valid: false, error: "Code promo invalide" }, status: :unprocessable_entity
        end
      end
    end
  end
end
