# Records storefront navigation / engagement in PostgreSQL (SQLite in prod).
class ClientActivityLogger
  def self.record(event_type:, session_id:, user: nil, product: nil, path: nil,
                  product_name: nil, product_id: nil, metadata: {}, rack_request: nil)
    sid = session_id.presence || extract_session_id(rack_request)
    return if sid.blank? || event_type.blank?

    pid = product&.id || product_id
    prod = product || (pid ? Product.find_by(id: pid) : nil)

    ClientActivityEvent.create!(
      user: user || Current.user,
      product: prod,
      session_id: sid,
      event_type: event_type.to_s,
      path: path.presence,
      product_name: product_name.presence || prod&.name,
      metadata: metadata.presence || {},
      ip_address: rack_request&.remote_ip,
      user_agent: rack_request&.user_agent&.truncate(500)
    )
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.warn("[ClientActivity] #{event_type}: #{e.message}")
  end

  def self.extract_session_id(request)
    return nil unless request

    request.get_header("HTTP_X_SESSION_ID").presence || request.session&.id&.to_s
  end
end
