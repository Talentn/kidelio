# Persists storefront activity off the request thread so high-frequency
# page_view / product_view events never tie up a Puma worker.
class ClientActivityJob < ApplicationJob
  queue_as :default

  def perform(event_type:, session_id:, user_id: nil, product_id: nil, path: nil,
              product_name: nil, metadata: {}, ip_address: nil, user_agent: nil)
    return if session_id.blank? || event_type.blank?

    prod = product_id ? Product.find_by(id: product_id) : nil

    ClientActivityEvent.create!(
      user_id: user_id,
      product: prod,
      session_id: session_id,
      event_type: event_type.to_s,
      path: path.presence,
      product_name: product_name.presence || prod&.name,
      metadata: metadata.presence || {},
      ip_address: ip_address,
      user_agent: user_agent&.truncate(500)
    )
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.warn("[ClientActivity] #{event_type}: #{e.message}")
  end
end
