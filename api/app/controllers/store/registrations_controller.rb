module Store
  class RegistrationsController < BaseController
    def new
      @user = User.new
    end

    def create
      @user = User.new(user_params.merge(role: :client))
      if @user.save
        sign_in(@user)
        redirect_to store_account_path, notice: "Compte créé avec succès."
      else
        render :new, status: :unprocessable_entity
      end
    end

    private

    def user_params
      params.require(:user).permit(:name, :email, :password, :phone)
    end
  end
end
