module Api
  module V1
    class PromoCodesController < BaseController
      skip_before_action :verify_authenticity_token, only: :validate_code

      def validate_code
        promo = PromoCode.active.find_by("LOWER(code) = ?", params[:code].to_s.downcase)
        subtotal = params[:subtotal].to_d
        customer = customer_identity_params

        if promo.nil?
          return render json: { valid: false, error: "Code promo invalide" }, status: :unprocessable_entity
        end

        if promo.once_per_customer? && promo.customer_already_used?(for_user: Current.user, customer: customer)
          return render json: {
            valid: false,
            error: "Ce code promo a déjà été utilisé pour ce client"
          }, status: :unprocessable_entity
        end

        if promo.usable?(for_user: Current.user, customer: customer) &&
            (promo.min_order_amount.nil? || subtotal >= promo.min_order_amount)
          discount = promo.apply_to(subtotal, for_user: Current.user, customer: customer)
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

      def customer_identity_params
        {
          guest_name: params[:guest_name],
          guest_phone: params[:guest_phone],
          shipping_governorate: params[:shipping_governorate],
          shipping_delegation: params[:shipping_delegation],
          shipping_address: params[:shipping_address]
        }
      end
    end
  end
end
