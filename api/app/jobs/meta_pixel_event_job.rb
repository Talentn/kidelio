# Fires Meta Conversions API events in the background so they don't
# add latency to the HTTP response the user is waiting for.
class MetaPixelEventJob < ApplicationJob
  queue_as :default

  # event: :purchase | :add_to_cart | :view_content
  def perform(event, **options)
    user_context = (options[:user_context] || {}).symbolize_keys
    api = MetaConversionsApi.new(user_context: user_context)

    case event.to_sym
    when :purchase
      order = Order.includes(order_items: :product).find(options[:order_id])
      api.track_purchase(order: order)

    when :add_to_cart
      product = Product.find(options[:product_id])
      api.track_add_to_cart(
        product:    product,
        quantity:   options[:quantity],
        price:      options[:price],
        color_id:   options[:color_id],
        size_label: options[:size_label]
      )

    when :view_content
      product = Product.includes(colors: :sizes).find(options[:product_id])
      api.track_view_content(product: product)
    end
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[MetaPixelEventJob] Record not found for #{event}: #{e.message}")
  end
end
