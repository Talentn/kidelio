module Api
  module Admin
    class HomepageController < BaseController
      def show
        render json: {
          assets: HomePageAsset::KEYS.map { |key| asset_json(HomePageAsset.for(key)) },
          sliders: HeroSlider.order(:position, :id).map { |s| slider_json(s) }
        }
      end

      def update_asset
        asset = HomePageAsset.for(params[:key])
        unless HomePageAsset::KEYS.include?(asset.key)
          return render json: { error: "Emplacement inconnu" }, status: :not_found
        end

        if params[:image].present?
          ImageOptimizer.attach_optimized(asset, :image, params[:image])
          invalidate_homepage_cache
          render json: { asset: asset_json(asset.reload) }
        else
          render json: { error: "Image requise" }, status: :unprocessable_entity
        end
      end

      private

      def asset_json(asset)
        {
          key: asset.key,
          label: HomePageAsset::LABELS[asset.key],
          image_url: json_image_url(asset.image)
        }
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
