class Rack::Attack
  throttle("api/ip", limit: 300, period: 5.minutes) do |req|
    req.ip if req.path.start_with?("/api")
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
end

Rails.application.config.middleware.use Rack::Attack
