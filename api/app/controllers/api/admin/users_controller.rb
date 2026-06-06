module Api
  module Admin
    class UsersController < BaseController
      before_action :require_admin!
      before_action :set_user, only: %i[update destroy]

      def index
        users = User.order(created_at: :desc).limit(500)
        render json: {
          users: users.map { |u| user_json(u) }
        }
      end

      def create
        role = create_params[:role].presence || "client"
        unless User.roles.key?(role)
          return render json: { error: "Rôle invalide" }, status: :unprocessable_entity
        end

        if STAFF_ROLES.include?(role) && create_params[:password].blank?
          return render json: { error: "Mot de passe requis pour un compte staff" }, status: :unprocessable_entity
        end

        existing = User.find_by(email: create_params[:email]&.strip&.downcase)
        if existing
          return render json: {
            error: "Un compte existe déjà avec cet email."
          }, status: :unprocessable_entity
        end

        user = User.new(
          email: create_params[:email],
          name: create_params[:name],
          phone: create_params[:phone],
          password: create_params[:password].presence || Devise.friendly_token[0, 20],
          role: role
        )

        if user.save
          render json: { user: user_json(user) }, status: :created
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def update
        if @user.id == Current.user.id && user_params[:role].present? && user_params[:role] != @user.role
          return render json: { error: "Vous ne pouvez pas modifier votre propre rôle" }, status: :unprocessable_entity
        end

        if user_params[:role].present? && !User.roles.key?(user_params[:role])
          return render json: { error: "Rôle invalide" }, status: :unprocessable_entity
        end

        if demoting_last_admin?(@user, user_params[:role])
          return render json: { error: "Impossible de retirer le dernier administrateur" }, status: :unprocessable_entity
        end

        attrs = user_params.except(:password)
        @user.assign_attributes(attrs)
        @user.password = user_params[:password] if user_params[:password].present?

        if @user.save
          render json: { user: user_json(@user) }
        else
          render json: { errors: @user.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def destroy
        if @user.id == Current.user.id
          return render json: { error: "Vous ne pouvez pas supprimer votre propre compte" }, status: :unprocessable_entity
        end

        if @user.admin? && User.admin.count <= 1
          return render json: { error: "Impossible de supprimer le dernier administrateur" }, status: :unprocessable_entity
        end

        @user.destroy!
        render json: { ok: true }
      end

      private

      STAFF_ROLES = %w[admin employee].freeze

      def set_user
        @user = User.find(params[:id])
      end

      def demoting_last_admin?(user, new_role)
        return false unless user.admin?
        return false if new_role.blank? || new_role == "admin"

        User.admin.where.not(id: user.id).none?
      end

      def user_params
        params.permit(:name, :phone, :role, :password)
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
