module Api
  module Admin
    class StatisticsController < BaseController
      PERIODS = {
        "today" => -> { [Time.current.beginning_of_day, Time.current.end_of_day] },
        "7d"    => -> { [7.days.ago.beginning_of_day, Time.current.end_of_day] },
        "30d"   => -> { [30.days.ago.beginning_of_day, Time.current.end_of_day] },
        "90d"   => -> { [90.days.ago.beginning_of_day, Time.current.end_of_day] },
        "year"  => -> { [Time.current.beginning_of_year, Time.current.end_of_day] },
        "all"   => -> { [nil, Time.current.end_of_day] }
      }.freeze

      def show
        period = PERIODS.key?(params[:period]) ? params[:period] : "30d"
        from, to = PERIODS[period].call
        duration = from ? (to - from) : nil
        prev_to = from ? from - 1.second : nil
        prev_from = duration ? prev_to - duration : nil

        orders = scoped_orders(from, to)
        prev_orders = scoped_orders(prev_from, prev_to)

        revenue_orders = orders.where.not(status: %i[cancelled refunded])
        prev_revenue_orders = prev_orders.where.not(status: %i[cancelled refunded])

        orders_count = orders.count
        prev_orders_count = prev_orders.count
        revenue = revenue_orders.sum(:total).to_f
        prev_revenue = prev_revenue_orders.sum(:total).to_f

        render json: {
          period: period,
          from: from&.to_date&.iso8601,
          to: to.to_date.iso8601,
          summary: {
            orders_count: orders_count,
            revenue: revenue,
            average_order_value: orders_count.positive? ? (revenue / orders_count).round(3) : 0,
            items_sold: items_sold(orders),
            new_customers: new_customers(from, to),
            guest_orders: orders.where(user_id: nil).count,
            registered_orders: orders.where.not(user_id: nil).count,
            discount_given: revenue_orders.sum(:discount_amount).to_f,
            shipping_revenue: revenue_orders.sum(:shipping_cost).to_f,
            cancelled_orders: orders.where(status: :cancelled).count,
            refunded_orders: orders.where(status: :refunded).count,
            low_stock_products: Product.active.where("stock < ?", 5).count,
            total_products: Product.count,
            unread_messages: ContactMessage.where(read: false).count
          },
          previous_period: {
            orders_count: prev_orders_count,
            revenue: prev_revenue,
            change_orders_pct: pct_change(prev_orders_count, orders_count),
            change_revenue_pct: pct_change(prev_revenue, revenue)
          },
          revenue_by_day: time_series(revenue_orders, from, to, period),
          orders_by_status: orders_by_status(orders),
          top_products: top_products(orders),
          top_governorates: top_governorates(revenue_orders),
          promo_usage: {
            orders_with_promo: revenue_orders.where.not(promo_code: [nil, ""]).count,
            total_discount: revenue_orders.sum(:discount_amount).to_f
          }
        }
      end

      private

      def scoped_orders(from, to)
        scope = Order.all
        scope = scope.where("created_at >= ?", from) if from
        scope = scope.where("created_at <= ?", to) if to
        scope
      end

      def items_sold(orders)
        OrderItem.where(order_id: orders.select(:id)).sum(:quantity)
      end

      def new_customers(from, to)
        scope = User.where(role: :client)
        scope = scope.where("created_at >= ?", from) if from
        scope = scope.where("created_at <= ?", to) if to
        scope.count
      end

      def pct_change(previous, current)
        return nil if previous.nil? || previous.zero?
        (((current - previous) / previous.to_f) * 100).round(1)
      end

      def time_series(revenue_orders, from, to, period)
        if period == "all"
          return monthly_series(revenue_orders)
        end
        return [] unless from

        counts = revenue_orders.group(day_expr).count
        sums = revenue_orders.group(day_expr).sum(:total)

        start_date = from.to_date
        end_date = to.to_date
        (start_date..end_date).map do |date|
          key = date.iso8601
          {
            date: key,
            orders: counts[key] || 0,
            revenue: (sums[key] || 0).to_f
          }
        end
      end

      def monthly_series(revenue_orders)
        expr = month_expr
        counts = revenue_orders.group(expr).count
        sums = revenue_orders.group(expr).sum(:total)
        keys = (counts.keys + sums.keys).uniq.sort

        keys.map do |key|
          {
            date: "#{key}-01",
            orders: counts[key] || 0,
            revenue: (sums[key] || 0).to_f
          }
        end
      end

      def day_expr
        sqlite? ? "date(orders.created_at)" : "DATE(orders.created_at)"
      end

      def month_expr
        sqlite? ? "strftime('%Y-%m', orders.created_at)" : "TO_CHAR(orders.created_at, 'YYYY-MM')"
      end

      def sqlite?
        ActiveRecord::Base.connection.adapter_name.downcase.include?("sqlite")
      end

      def orders_by_status(orders)
        counts = orders.group(:status).count
        Order.statuses.keys.map do |status|
          { status: status, count: counts[status] || 0 }
        end
      end

      def top_products(orders)
        OrderItem
          .where(order_id: orders.select(:id))
          .group(:product_name)
          .select(
            "product_name",
            "SUM(quantity) AS quantity",
            "SUM(quantity * unit_price) AS revenue"
          )
          .order("quantity DESC")
          .limit(10)
          .map { |row| { product_name: row.product_name, quantity: row.quantity.to_i, revenue: row.revenue.to_f } }
      end

      def top_governorates(revenue_orders)
        revenue_orders
          .group(:shipping_governorate)
          .select(
            "shipping_governorate",
            "COUNT(*) AS orders_count",
            "SUM(total) AS revenue"
          )
          .order("orders_count DESC")
          .limit(8)
          .map { |row| { governorate: row.shipping_governorate, orders: row.orders_count, revenue: row.revenue.to_f } }
      end
    end
  end
end
