module Api
  module V1
    class RewardsController < BaseController
      before_action :require_user!

      def show
        render json: { rewards: LoyaltyProgram.snapshot(Current.user) }
      end

      def claim
        result = LoyaltyProgram.claim!(Current.user, params.require(:type))
        render json: {
          ok: true,
          reward: result,
          rewards: LoyaltyProgram.snapshot(Current.user.reload)
        }
      rescue ArgumentError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end
    end
  end
end
