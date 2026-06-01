module Api
  module Admin
    class PromoPopupsController < BaseController
      def index
        render json: { promos: PromoPopup.order(:position, :id).map { |p| promo_json(p) } }
      end

      def create
        promo = PromoPopup.new(promo_params)
        if promo.save
          attach_image(promo)
          render json: { promo: promo_json(promo) }, status: :created
        else
          render json: { errors: promo.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def update
        promo = PromoPopup.find(params[:id])
        if promo.update(promo_params)
          attach_image(promo)
          render json: { promo: promo_json(promo) }
        else
          render json: { errors: promo.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def destroy
        PromoPopup.find(params[:id]).destroy!
        head :no_content
      end

      private

      def promo_params
        cast_booleans(
          params.permit(:title, :link_url, :active, :position),
          :active
        )
      end

      def attach_image(promo)
        return unless params[:image].present?

        ImageOptimizer.attach_optimized(promo, :image, params[:image])
        ActivityLogger.log_media(promo, attachment: :image, detail: "Image bannière mise à jour")
      end

      def promo_json(promo)
        {
          id: promo.id,
          title: promo.title,
          link_url: promo.link_url,
          active: promo.active,
          position: promo.position,
          image_url: json_image_url(promo.image)
        }
      end
    end
  end
end
