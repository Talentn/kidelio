module Admin
  class SessionsController < ApplicationController
    layout "admin"

    def new
      redirect_to admin_root_path if Current.user&.staff?
    end

    def create
      user = User.find_by(email: params[:email]&.strip&.downcase)
      if user&.valid_password?(params[:password]) && user.staff?
        sign_in(user)
        redirect_to admin_root_path, notice: "Bienvenue, #{user.name}."
      else
        flash.now[:alert] = "Identifiants invalides ou accès refusé."
        render :new, status: :unprocessable_entity
      end
    end

    def destroy
      sign_out
      redirect_to new_admin_session_path, notice: "Déconnexion."
    end
  end
end
