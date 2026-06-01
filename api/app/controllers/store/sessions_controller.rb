module Store
  class SessionsController < BaseController
    def new
    end

    def create
      user = User.find_by(email: params[:email]&.strip&.downcase)
      if user&.valid_password?(params[:password])
        sign_in(user)
        redirect_to after_login_path, notice: "Bienvenue, #{user.name} !"
      else
        flash.now[:alert] = "Email ou mot de passe incorrect."
        render :new, status: :unprocessable_entity
      end
    end

    def destroy
      sign_out
      redirect_to root_path, notice: "Déconnexion réussie."
    end

    private

    def after_login_path
      params[:return_to].presence || store_account_path
    end
  end
end
