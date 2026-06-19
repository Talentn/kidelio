# Records storefront cart activity in PostgreSQL for admin live tracking.
# Runs synchronously from CartController — no go-service dependency.
class LiveActivityLogger
  def self.record_cart_event(event:, session_id: nil, user: nil, product: nil, quantity: 1, price: nil,
                             color_id: nil, color_label: nil, size_label: nil, rack_request: nil)
    sid = session_id.presence || extract_session_id(rack_request)
    return if sid.blank?

    CartLiveEvent.create!(
      user: user,
      product: product,
      session_id: sid,
      action: event,
      product_name: product&.name,
      quantity: quantity.to_i.clamp(1, 99),
      price: price,
      color_id: color_id.presence&.to_i,
      color_label: color_label.presence,
      size_label: size_label.presence,
      ip_address: rack_request&.remote_ip,
      user_agent: rack_request&.user_agent&.truncate(500)
    )
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.warn("[LiveActivity] cart #{event}: #{e.message}")
  end

  def self.extract_session_id(request)
    return nil unless request

    request.get_header("HTTP_X_SESSION_ID").presence || request.session&.id&.to_s
  end
end
