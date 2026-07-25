# Async work via Solid Queue (not for browser — faster checkout response).
class ProcessOrderJob < ApplicationJob
  queue_as :default

  def perform(order_id)
    order = Order.find(order_id)
    Rails.logger.info("[ProcessOrderJob] Order #{order.order_number} queued for notifications")
    # Intigo colis are created manually from admin (send_to_intigo), not auto.

    SendWebPushJob.perform_later(
      "order",
      title: "Nouvelle commande #{order.order_number}",
      body: "#{order.guest_name} — #{format('%.3f', order.total)} TND (#{order.shipping_governorate})",
      url: "/admin/commandes",
      tag: "kidelio-order"
    )
  end
end
