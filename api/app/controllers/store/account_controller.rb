module Store
  class AccountController < BaseController
    before_action :require_user_html!

    def show
      @orders = Current.user.orders.order(created_at: :desc).limit(20)
    end
  end
end
