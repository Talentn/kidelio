# Async work via Solid Queue (not for browser — faster checkout response).
class ProcessOrderJob < ApplicationJob
  queue_as :default

  def perform(order_id)
    order = Order.find(order_id)
    Rails.logger.info("[ProcessOrderJob] Order #{order.order_number} queued for notifications")
    # Phase 2: email/SMS, JAX submit, Meta CAPI
  end
end
