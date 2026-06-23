require "net/http"
require "rack/utils"

class GoServiceClient
  def self.base_uri
    ENV.fetch("GO_SERVICE_URL", "http://127.0.0.1:3010")
  end

  def self.forward(method:, path:, body: nil, rack_request:, staff: nil, customer: nil,
                   open_timeout: 3, read_timeout: 15)
    uri = URI("#{base_uri}#{path}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == "https"
    http.open_timeout = open_timeout
    http.read_timeout = read_timeout

    req = request_class(method).new(uri)
    req["Content-Type"] = rack_request.content_type if rack_request.content_type.present?
    cookie = cookie_header(rack_request)
    req["Cookie"] = cookie if cookie.present?
    req["X-Forwarded-For"] = rack_request.remote_ip
    req["X-Forwarded-Proto"] = rack_request.ssl? ? "https" : "http"
    session_id = rack_request.get_header("HTTP_X_SESSION_ID").presence ||
      rack_request.headers["X-Session-Id"].presence
    req["X-Session-Id"] = session_id if session_id.present?
    attach_staff_headers(req, staff) if staff&.staff?
    attach_customer_headers(req, customer) if customer
    req.body = body if body.present? && req.request_body_permitted?

    http.request(req)
  end

  def self.cookie_header(rack_request)
    rack_request.get_header("HTTP_COOKIE").presence ||
      rack_request.headers["Cookie"].presence ||
      rack_request.cookies.map { |k, v| "#{Rack::Utils.escape(k)}=#{Rack::Utils.escape(v)}" }.join("; ").presence
  end
  private_class_method :cookie_header

  def self.attach_customer_headers(req, customer)
    req["X-Kidelio-Customer-Id"] = customer.id.to_s
    req["X-Kidelio-Customer-Name"] = customer.name.to_s
    req["X-Kidelio-Customer-Email"] = customer.email.to_s
  end
  private_class_method :attach_customer_headers

  def self.attach_staff_headers(req, staff)
    secret = internal_secret
    return if secret.blank?

    req["X-Kidelio-Internal"] = secret
    req["X-Kidelio-User-Id"] = staff.id.to_s
    req["X-Kidelio-User-Name"] = staff.name.to_s
    req["X-Kidelio-User-Role"] = staff.role
  end
  private_class_method :attach_staff_headers

  def self.internal_secret
    ENV["GO_INTERNAL_SECRET"].presence || (Rails.env.development? ? "dev-internal" : nil)
  end
  private_class_method :internal_secret

  def self.request_class(method)
    {
      "GET" => Net::HTTP::Get,
      "POST" => Net::HTTP::Post,
      "PUT" => Net::HTTP::Put,
      "PATCH" => Net::HTTP::Patch,
      "DELETE" => Net::HTTP::Delete
    }.fetch(method.upcase)
  end
  private_class_method :request_class
end
