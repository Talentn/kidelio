module Api
  module V1
    class HeroSlidersController < BaseController
      def index
        data = cache_response("hero_sliders") do
          HeroSlider.active.map do |s|
            {
              id: s.id,
              title: s.title,
              subtitle: s.subtitle,
              link_url: s.link_url,
              image_url: json_variant_url(s.image, size: :large)
            }
          end
        end
        expires_in 5.minutes, public: true
        render json: { sliders: data }
      end
    end
  end
end
