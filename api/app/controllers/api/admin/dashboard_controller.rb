module Api
  module Admin
    class DashboardController < BaseController
      def stats
        reviews_today = ProductReview.where("created_at >= ?", Time.current.beginning_of_day)

        render json: {
          orders_today: Order.where("created_at >= ?", Time.current.beginning_of_day).count,
          revenue_today: Order.where("created_at >= ?", Time.current.beginning_of_day).sum(:total),
          pending_orders: Order.pending.count,
          low_stock_products: Product.active.where("stock < ?", 5).count,
          total_products: Product.count,
          unread_messages: ContactMessage.where(read: false).count,
          total_reviews: ProductReview.count,
          average_rating: ProductReview.average(:stars)&.to_f&.round(1) || 0,
          reviews_today: reviews_today.count
        }
      end
    end
  end
end
