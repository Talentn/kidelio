module Api
  module V1
    class PromoPopupsController < BaseController
      def index
        data = PromoPopup.active.filter_map do |p|
          next unless p.image.attached?

          {
            id: p.id,
            title: p.title,
            link_url: p.link_url,
            image_url: json_image_url(p.image)
          }
        end

        expires_in 2.minutes, public: true
        render json: { promos: data }
      end
    end
  end
end
