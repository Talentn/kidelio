module Api
  module Admin
    class DashboardController < BaseController
      def stats
        render json: {
          orders_today: Order.where("created_at >= ?", Time.current.beginning_of_day).count,
          revenue_today: Order.where("created_at >= ?", Time.current.beginning_of_day).sum(:total),
          pending_orders: Order.pending.count,
          low_stock_products: Product.active.where("stock < ?", 5).count,
          total_products: Product.count,
          unread_messages: ContactMessage.where(read: false).count
        }
      end
    end
  end
end
