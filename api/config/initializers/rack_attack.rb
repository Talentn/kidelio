class Rack::Attack
  # Storefront JSON API only — admin/back-office has its own auth and must not
  # share the public IP quota (live polling would hit 429 and freeze admin pages).
  def self.storefront_api?(req)
    return false unless req.path.start_with?("/api")
    return false if req.path.start_with?("/api/admin")
    return false if req.path.include?("/admin/")

    true
  end

  throttle("api/ip", limit: 300, period: 5.minutes) do |req|
    req.ip if storefront_api?(req)
  end

  throttle("orders/ip", limit: 10, period: 1.minute) do |req|
    req.ip if req.post? && req.path == "/api/v1/orders"
  end

  throttle("auth/ip", limit: 20, period: 5.minutes) do |req|
    req.ip if req.post? && req.path.include?("/auth/login")
  end

  throttle("reviews/ip", limit: 30, period: 5.minutes) do |req|
    req.ip if req.post? && req.path.match?(%r{\A/api/v1/products/[^/]+/review\z})
  end

  self.throttled_responder = lambda do |_request|
    [ 429, { "Content-Type" => "application/json" }, [ { error: "Trop de requêtes. Réessayez dans un instant." }.to_json ] ]
  end
end

Rails.application.config.middleware.use Rack::Attack
