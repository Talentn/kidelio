class LiveCartEventJob < ApplicationJob
  queue_as :default

  def perform(event, product_id: nil, product_name: nil, quantity: 1, price: nil,
              color_id: nil, color_label: nil, size_label: nil, session_id: nil, user_id: nil)
    product = product_id ? Product.find_by(id: product_id) : nil
    user = user_id ? User.find_by(id: user_id) : nil

    LiveActivityLogger.record_cart_event(
      event: event,
      session_id: session_id,
      user: user,
      product: product,
      quantity: quantity,
      price: price,
      color_id: color_id,
      color_label: color_label,
      size_label: size_label
    )
  end
end
