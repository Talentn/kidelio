module Api
  module V1
    class HomepageController < BaseController
      def show
        data = cache_response("homepage") do
          {
            assets: homepage_assets_json,
            sliders: hero_sliders_json
          }
        end
        expires_in 5.minutes, public: true
        render json: data
      end

      private

      def homepage_assets_json
        HomePageAsset::KEYS.index_with do |key|
          asset = HomePageAsset.find_by(key: key)
          asset&.image&.attached? ? json_variant_url(asset.image, size: :large) : nil
        end
      end

      def hero_sliders_json
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
    end
  end
end
