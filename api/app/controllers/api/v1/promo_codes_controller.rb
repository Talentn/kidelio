module Api
  module V1
    class PromoCodesController < BaseController
      skip_before_action :verify_authenticity_token, only: :validate_code

      def store_offer
        promo = PromoCode.for_product_display.first
        unless promo
          return render json: { promo: nil, eligible: false, first_time_unknown: false }
        end

        customer = customer_identity_params
        eligible = offer_eligible?(promo, customer)
        guest_identity_missing = Current.user.nil? && customer.values.all?(&:blank?)

        render json: {
          promo: store_offer_json(promo),
          eligible: eligible,
          first_time_unknown: guest_identity_missing && promo.once_per_customer?
        }
      end

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

      private

      def customer_identity_params
        {
          guest_name: params[:guest_name],
          guest_phone: params[:guest_phone],
          shipping_governorate: params[:shipping_governorate],
          shipping_delegation: params[:shipping_delegation],
          shipping_address: params[:shipping_address]
        }
      end

      def offer_eligible?(promo, customer)
        return false unless promo.usable?(for_user: Current.user, customer: customer)
        return false if promo.once_per_customer? &&
          promo.customer_already_used?(for_user: Current.user, customer: customer)

        true
      end

      def store_offer_json(promo)
        {
          code: promo.code,
          discount_type: promo.discount_type,
          discount_value: promo.discount_value,
          max_discount: promo.max_discount,
          min_order_amount: promo.min_order_amount,
          once_per_customer: promo.once_per_customer
        }
      end
    end
  end
end
