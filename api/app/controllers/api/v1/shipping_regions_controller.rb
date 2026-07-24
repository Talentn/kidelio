module Api
  module V1
    class ShippingRegionsController < BaseController
      def cities
        render json: { cities: IntigoRegions.cities }
      rescue IntigoRegions::Error, IntigoClient::Error => e
        render json: { error: e.message, cities: [] }, status: :service_unavailable
      end

      def districts
        render json: {
          city_id: params[:city_id].to_i,
          districts: IntigoRegions.districts(params[:city_id])
        }
      rescue IntigoRegions::Error, IntigoClient::Error => e
        render json: { error: e.message, districts: [] }, status: :service_unavailable
      end
    end
  end
end
