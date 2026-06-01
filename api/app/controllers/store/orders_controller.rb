module Store
  class OrdersController < BaseController
    def show
      @order = Order.find_by!(order_number: params[:id])
    end
  end
end
