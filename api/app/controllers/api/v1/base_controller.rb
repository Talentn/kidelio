module Api
  module V1
    class BaseController < ApplicationController
      include CartAccess

      private

      def cache_response(key, expires_in: 5.minutes, &block)
        Rails.cache.fetch(cache_key_with_version(key), expires_in: expires_in, &block)
      end

      def cache_key_with_version(key)
        "v1/#{key}/#{catalog_cache_version}-#{Product.maximum(:updated_at)&.to_i}-#{Category.maximum(:updated_at)&.to_i}"
      end
    end
  end
end
