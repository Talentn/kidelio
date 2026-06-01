module Admin
  class OrdersController < BaseController
    before_action :set_order, only: %i[show update]

    def index
      @orders = Order.includes(:user, :order_items).order(created_at: :desc).limit(200)
    end

    def show
    end

    def update
      if @order.update(order_params)
        redirect_to admin_order_path(@order), notice: "Commande mise à jour."
      else
        render :show, status: :unprocessable_entity
      end
    end

    private

    def set_order
      @order = Order.find(params[:id])
    end

    def order_params
      params.require(:order).permit(:status, :notes)
    end
  end
end
