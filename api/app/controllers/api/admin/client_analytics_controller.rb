module Api
  module Admin
    class ClientAnalyticsController < BaseController
      PERIODS = {
        "today" => -> { [ Time.current.beginning_of_day, Time.current.end_of_day ] },
        "7d"    => -> { [ 7.days.ago.beginning_of_day, Time.current.end_of_day ] },
        "30d"   => -> { [ 30.days.ago.beginning_of_day, Time.current.end_of_day ] },
        "90d"   => -> { [ 90.days.ago.beginning_of_day, Time.current.end_of_day ] }
      }.freeze

      def show
        period = PERIODS.key?(params[:period]) ? params[:period] : "7d"
        from, to = PERIODS[period].call
        duration = to - from
        prev_to = from - 1.second
        prev_from = prev_to - duration

        cart = CartLiveEvent.includes(:user).where(created_at: from..to)
        prev_cart = CartLiveEvent.where(created_at: prev_from..prev_to)
        activity = ClientActivityEvent.includes(:user).where(created_at: from..to)
        prev_activity = ClientActivityEvent.where(created_at: prev_from..prev_to)

        cart_adds = cart.where(action: "add")
        prev_cart_adds = prev_cart.where(action: "add")

        sessions = (cart.pluck(:session_id) + activity.pluck(:session_id)).uniq.size
        prev_sessions = (prev_cart.pluck(:session_id) + prev_activity.pluck(:session_id)).uniq.size

        product_views = activity.where(event_type: "product_view")
        checkouts = activity.where(event_type: "checkout_start")
        page_leaves = activity.where(event_type: "page_leave")

        cart_add_count = cart_adds.count
        checkout_count = checkouts.count

        render json: {
          period: period,
          timezone: Time.zone.tzinfo.name,
          from: from.iso8601,
          to: to.iso8601,
          kpis: {
            sessions: sessions,
            product_views: product_views.count,
            cart_adds: cart_add_count,
            cart_removals: cart.where(action: "remove").count,
            checkouts: checkout_count,
            searches: activity.where(event_type: "search").count,
            favorites: activity.where(event_type: "favorite_add").count,
            avg_dwell_seconds: average_dwell_seconds(page_leaves),
            conversion_cart_to_checkout_pct: conversion_pct(checkout_count, cart_add_count)
          },
          previous_period: {
            sessions: prev_sessions,
            product_views: prev_activity.where(event_type: "product_view").count,
            cart_adds: prev_cart_adds.count,
            checkouts: prev_activity.where(event_type: "checkout_start").count,
            change_sessions_pct: pct_change(prev_sessions, sessions),
            change_cart_adds_pct: pct_change(prev_cart_adds.count, cart_add_count),
            change_product_views_pct: pct_change(prev_activity.where(event_type: "product_view").count, product_views.count)
          },
          activity_by_day: activity_by_day(cart, activity, from, to),
          activity_by_hour: activity_by_hour(cart, activity),
          top_viewed_products: top_products(product_views, :views),
          top_cart_products: top_cart_products(cart_adds),
          top_searches: top_searches(activity.where(event_type: "search")),
          recent_cart_adds: recent_cart_adds(cart_adds),
          recent_activity: recent_activity(activity)
        }
      end

      private

      def average_dwell_seconds(scope)
        durations = scope.filter_map do |e|
          ms = e.metadata["duration_ms"] || e.metadata[:duration_ms]
          ms.to_i if ms.present?
        end
        return 0 if durations.empty?

        (durations.sum / durations.size / 1000.0).round(1)
      end

      def conversion_pct(numerator, denominator)
        return 0.0 if denominator.zero?

        ((numerator.to_f / denominator) * 100).round(1)
      end

      def pct_change(prev, current)
        return nil if prev.zero? && current.zero?
        return 100.0 if prev.zero?

        (((current - prev).to_f / prev) * 100).round(1)
      end

      def activity_by_day(cart_scope, activity_scope, from, to)
        days = {}
        (from.to_date..to.to_date).each { |d| days[d.iso8601] = { date: d.iso8601, cart_adds: 0, product_views: 0, sessions: 0 } }

        cart_scope.where(action: "add").find_each do |e|
          key = e.created_at.in_time_zone.to_date.iso8601
          days[key][:cart_adds] += 1 if days[key]
        end

        activity_scope.where(event_type: "product_view").find_each do |e|
          key = e.created_at.in_time_zone.to_date.iso8601
          days[key][:product_views] += 1 if days[key]
        end

        session_days = Hash.new { |h, k| h[k] = Set.new }
        cart_scope.find_each { |e| session_days[e.created_at.in_time_zone.to_date.iso8601] << e.session_id }
        activity_scope.find_each { |e| session_days[e.created_at.in_time_zone.to_date.iso8601] << e.session_id }
        session_days.each { |day, set| days[day][:sessions] = set.size if days[day] }

        days.values
      end

      def activity_by_hour(cart_scope, activity_scope)
        hours = Array.new(24) { |h| { hour: h, label: "#{h.to_s.rjust(2, '0')}h", events: 0 } }
        (cart_scope.to_a + activity_scope.to_a).each do |e|
          h = e.created_at.in_time_zone.hour
          hours[h][:events] += 1
        end
        hours
      end

      def top_products(scope, _kind)
        counts = Hash.new(0)
        names = {}
        scope.find_each do |e|
          key = e.product_id || e.product_name
          next if key.blank?

          counts[key] += 1
          names[key] = e.product_name.presence || "Produit ##{e.product_id}"
        end
        counts.sort_by { |_, c| -c }.first(10).map do |key, count|
          { product_id: key.is_a?(Integer) ? key : nil, product_name: names[key], count: count }
        end
      end

      def top_cart_products(cart_adds)
        stats = Hash.new { |h, k| h[k] = { count: 0, quantity: 0, revenue: 0.0, name: nil } }
        cart_adds.find_each do |e|
          key = e.product_id || e.product_name
          next if key.blank?

          stats[key][:count] += 1
          stats[key][:quantity] += e.quantity
          stats[key][:revenue] += e.price.to_f * e.quantity
          stats[key][:name] ||= e.product_name
        end
        stats.map do |key, s|
          {
            product_id: key.is_a?(Integer) ? key : nil,
            product_name: s[:name] || "Produit",
            adds: s[:count],
            quantity: s[:quantity],
            revenue: s[:revenue].round(3)
          }
        end.sort_by { |r| -r[:adds] }.first(10)
      end

      def top_searches(scope)
        counts = Hash.new(0)
        scope.find_each do |e|
          q = e.metadata["query"] || e.metadata[:query]
          next if q.blank?

          counts[q.to_s] += 1
        end
        counts.sort_by { |_, c| -c }.first(8).map { |query, count| { query: query, count: count } }
      end

      def recent_cart_adds(scope)
        scope.order(created_at: :desc).limit(25).map { |e| serialize_cart_event(e) }
      end

      def recent_activity(scope)
        scope.order(created_at: :desc).limit(30).map { |e| serialize_activity_event(e) }
      end

      def serialize_cart_event(e)
        {
          id: e.id,
          action: e.action,
          product_id: e.product_id,
          product_name: e.product_name,
          quantity: e.quantity,
          price: e.price.to_f,
          color_label: e.color_label,
          size_label: e.size_label,
          session_id: e.session_id,
          user_id: e.user_id,
          user_name: e.user&.name,
          created_at: e.created_at.iso8601
        }
      end

      def serialize_activity_event(e)
        {
          id: e.id,
          event_type: e.event_type,
          path: e.path,
          product_id: e.product_id,
          product_name: e.product_name,
          metadata: e.metadata,
          session_id: e.session_id,
          user_id: e.user_id,
          user_name: e.user&.name,
          created_at: e.created_at.iso8601
        }
      end
    end
  end
end
