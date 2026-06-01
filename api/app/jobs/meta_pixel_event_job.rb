# Fires Meta Conversions API events in the background so they don't
# add latency to the HTTP response the user is waiting for.
class MetaPixelEventJob < ApplicationJob
  queue_as :default

  # event: :purchase | :add_to_cart | :view_content
  # options keys depend on the event type — see MetaConversionsApi
  def perform(event, **options)
    api = MetaConversionsApi.new

    case event.to_sym
    when :purchase
      order = Order.includes(:order_items).find(options[:order_id])
      api.track_purchase(order: order)

    when :add_to_cart
      product = Product.find(options[:product_id])
      api.track_add_to_cart(
        product:  product,
        quantity: options[:quantity],
        price:    options[:price],
      )

    when :view_content
      product = Product.find(options[:product_id])
      api.track_view_content(product: product)
    end
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[MetaPixelEventJob] Record not found for #{event}: #{e.message}")
  end
end
