module Api
  module Admin
    class PromoCodesController < BaseController
      before_action :set_promo_code, only: %i[update destroy]

      def index
        promos = PromoCode.order(created_at: :desc)
        render json: { promo_codes: promos.map { |p| promo_code_json(p) } }
      end

      def create
        promo = PromoCode.new(promo_code_params)
        if promo.save
          render json: { promo_code: promo_code_json(promo) }, status: :created
        else
          render json: { errors: promo.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def update
        if @promo_code.update(promo_code_params)
          render json: { promo_code: promo_code_json(@promo_code) }
        else
          render json: { errors: @promo_code.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def destroy
        @promo_code.destroy!
        head :no_content
      end

      private

      def set_promo_code
        @promo_code = PromoCode.find(params[:id])
      end

      def promo_code_params
        cast_booleans(
          params.permit(
            :code, :discount_type, :discount_value, :min_order_amount,
            :max_discount, :usage_limit, :expires_at, :active, :once_per_customer
          ),
          :active, :once_per_customer
        )
      end

      def promo_code_json(promo)
        {
          id: promo.id,
          code: promo.code,
          discount_type: promo.discount_type,
          discount_type_label: promo.percentage? ? "Pourcentage" : "Montant fixe",
          discount_value: promo.discount_value,
          discount_label: discount_label(promo),
          min_order_amount: promo.min_order_amount,
          max_discount: promo.max_discount,
          usage_limit: promo.usage_limit,
          used_count: promo.used_count,
          expires_at: promo.expires_at,
          active: promo.active,
          once_per_customer: promo.once_per_customer,
          usable: promo.usable?,
          status_label: promo.status_label,
          created_at: promo.created_at
        }
      end

      def discount_label(promo)
        if promo.percentage?
          label = "#{promo.discount_value.to_i == promo.discount_value ? promo.discount_value.to_i : promo.discount_value}%"
          label += " (max #{promo.max_discount} TND)" if promo.max_discount.present?
          label
        else
          "#{promo.discount_value} TND"
        end
      end
    end
  end
end
