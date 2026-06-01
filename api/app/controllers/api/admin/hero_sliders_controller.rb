module Api
  module Admin
    class HeroSlidersController < BaseController
      before_action :set_slider, only: %i[update destroy]

      def index
        render json: { sliders: HeroSlider.order(:position, :id).map { |s| slider_json(s) } }
      end

      def create
        slider = HeroSlider.new(slider_params)
        if slider.save
          attach_image(slider)
          invalidate_homepage_cache
          render json: { slider: slider_json(slider) }, status: :created
        else
          render json: { errors: slider.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def update
        if @slider.update(slider_params)
          attach_image(@slider)
          invalidate_homepage_cache
          render json: { slider: slider_json(@slider) }
        else
          render json: { errors: @slider.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def destroy
        @slider.destroy!
        invalidate_homepage_cache
        head :no_content
      end

      private

      def set_slider
        @slider = HeroSlider.find(params[:id])
      end

      def slider_params
        cast_booleans(
          params.permit(:title, :subtitle, :link_url, :active, :position),
          :active
        )
      end

      def attach_image(slider)
        return unless params[:image].present?

        ImageOptimizer.attach_optimized(slider, :image, params[:image])
      end

      def slider_json(slider)
        {
          id: slider.id,
          title: slider.title,
          subtitle: slider.subtitle,
          link_url: slider.link_url,
          active: slider.active,
          position: slider.position,
          image_url: json_image_url(slider.image)
        }
      end

      def invalidate_homepage_cache
        Rails.cache.delete_matched(/^v1\/homepage/) rescue nil
        Rails.cache.delete_matched(/hero_sliders/) rescue nil
      end
    end
  end
end
