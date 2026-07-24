class IntigoCreateParcelJob < ApplicationJob
  queue_as :default

  discard_on IntigoParcelCreator::Error

  def perform(order_id, force: false)
    order = Order.find_by(id: order_id)
    return unless order
    return if order.intigo_nid.present? && !force

    IntigoParcelCreator.new(order, force: force).call
  rescue IntigoParcelCreator::Error => e
    Rails.logger.warn("[IntigoCreateParcelJob] Order #{order&.order_number}: #{e.message}")
    raise
  end
end
