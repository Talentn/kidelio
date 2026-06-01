module Api
  module Admin
    class BaseController < ApplicationController
      include AdminParamCasting

      skip_before_action :verify_authenticity_token

      before_action :require_staff!

      private

      def invalidate_catalog_cache
        Rails.cache.delete_matched(/^v1\//) rescue nil
      end
    end
  end
end
