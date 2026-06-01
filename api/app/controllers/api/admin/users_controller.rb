module Api
  module Admin
    class UsersController < BaseController
      before_action :require_admin!

      STAFF_ROLES = %w[admin employee].freeze

      def index
        users = User.order(created_at: :desc).limit(500)
        render json: {
          users: users.map { |u| user_json(u) }
        }
      end

      def create
        role = create_params[:role].presence || "admin"
        unless STAFF_ROLES.include?(role)
          return render json: { error: "Le rôle doit être admin ou employé" }, status: :unprocessable_entity
        end

        existing = User.find_by(email: create_params[:email]&.strip&.downcase)
        if existing
          return render json: {
            error: "Un compte existe déjà avec cet email. Promouvez-le depuis la liste des utilisateurs."
          }, status: :unprocessable_entity
        end

        user = User.new(
          email: create_params[:email],
          name: create_params[:name],
          phone: create_params[:phone],
          password: create_params[:password],
          role: role
        )

        if user.save
          render json: { user: user_json(user) }, status: :created
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def update
        user = User.find(params[:id])
        if user.id == Current.user.id && user_params[:role].present? && user_params[:role] != user.role
          return render json: { error: "Vous ne pouvez pas modifier votre propre rôle" }, status: :unprocessable_entity
        end

        if user_params[:role].present? && !User.roles.key?(user_params[:role])
          return render json: { error: "Rôle invalide" }, status: :unprocessable_entity
        end

        if user.update(user_params)
          render json: { user: user_json(user) }
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def user_params
        params.permit(:name, :phone, :role)
      end

      def create_params
        params.permit(:name, :email, :phone, :password, :role)
      end

      def user_json(user)
        {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          provider: user.provider,
          fidelity_points: user.fidelity_points,
          orders_count: user.orders.count,
          created_at: user.created_at
        }
      end
    end
  end
end
