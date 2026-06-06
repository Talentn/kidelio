module Api
  module V1
    class AuthController < BaseController
      skip_before_action :verify_authenticity_token

      def me
        if Current.user
          render json: { user: user_json(Current.user) }
        else
          render json: { user: nil }
        end
      end

      def register
        user = User.new(
          email: params[:email],
          name: params[:name],
          password: params[:password],
          phone: params[:phone],
          role: :client
        )
        if user.save
          sign_in(user)
          render json: { user: user_json(user) }, status: :created
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def login
        user = User.find_by(email: params[:email]&.strip&.downcase)
        if user&.valid_password?(params[:password])
          sign_in(user)
          render json: { user: user_json(user) }
        else
          render json: { error: "Email ou mot de passe incorrect" }, status: :unauthorized
        end
      end

      def logout
        sign_out
        render json: { ok: true }
      end

      private

      def user_json(user)
        {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          fidelity_points: user.fidelity_points,
          wallet_balance: user.wallet_balance.to_d,
          loyalty_spend_progress: user.loyalty_spend_progress.to_d
        }
      end
    end
  end
end
