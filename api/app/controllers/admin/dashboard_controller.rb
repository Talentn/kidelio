module Admin
  class DashboardController < BaseController
    def index
      @orders_today = Order.where("created_at >= ?", Time.current.beginning_of_day)
      @stats = {
        orders_today: @orders_today.count,
        revenue_today: @orders_today.sum(:total),
        pending_orders: Order.pending.count,
        low_stock: Product.active.where("stock < ?", 5).count,
        total_products: Product.count,
        unread_messages: ContactMessage.where(read: false).count
      }
      @recent_orders = Order.order(created_at: :desc).limit(8)
    end
  end
end
