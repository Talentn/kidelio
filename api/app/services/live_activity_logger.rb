# Records storefront cart activity in go-service for admin live tracking.
# Server-side so ad blockers cannot intercept (unlike browser POST /cart/signals).
class LiveActivityLogger
  def self.record_cart_event(event:, session_id: nil, user: nil, product: nil, quantity: 1, price: nil,
                             color_id: nil, color_label: nil, size_label: nil, rack_request: nil)
    sid = session_id.presence || extract_session_id(rack_request)
    return if sid.blank?

    payload = {
      session_id: sid,
      user_id: user&.id,
      product_id: product&.id,
      product_name: product&.name.to_s.presence,
      quantity: quantity.to_i,
      price: price&.to_f,
      color_id: color_id.presence&.to_i,
      color_label: color_label.presence,
      size_label: size_label.presence
    }.compact

    req = rack_request || minimal_rack_request(session_id: sid, user: user)

    # Prefer /cart/signals (avoids ad-blocker patterns); fall back to /cart/events for older go-service builds.
    unless post_cart_payload(req, "/cart/signals", payload.merge(event: event), user: user)
      post_cart_payload(req, "/cart/events", payload.merge(action: event), user: user)
    end
  rescue Errno::ECONNREFUSED, SocketError, Net::OpenTimeout, Net::ReadTimeout, Timeout::Error => e
    Rails.logger.warn("[LiveActivity] go-service unavailable: #{e.message}")
  rescue StandardError => e
    Rails.logger.warn("[LiveActivity] cart #{event}: #{e.message}")
  end

  def self.post_cart_payload(rack_request, path, body, user: nil)
    res = GoServiceClient.forward(
      method: "POST",
      path: path,
      body: body.to_json,
      rack_request: rack_request,
      customer: user
    )
    ok = res.code.to_i.between?(200, 299)
    unless ok
      Rails.logger.warn("[LiveActivity] POST #{path} → #{res.code}: #{res.body.to_s.truncate(200)}")
    end
    ok
  end
  private_class_method :post_cart_payload

  def self.extract_session_id(request)
    return nil unless request

    request.get_header("HTTP_X_SESSION_ID").presence || request.session&.id&.to_s
  end

  def self.minimal_rack_request(session_id:, user: nil)
    env = Rack::MockRequest.env_for(
      "/",
      "HTTP_X_SESSION_ID" => session_id,
      "HTTP_COOKIE" => ""
    )
    req = ActionDispatch::Request.new(env)
    req.session[:user_id] = user.id if user
    req
  end

  private_class_method :extract_session_id, :minimal_rack_request
end
