require "net/http"

class GoServiceClient
  def self.base_uri
    ENV.fetch("GO_SERVICE_URL", "http://127.0.0.1:3010")
  end

  def self.forward(method:, path:, body: nil, rack_request:)
    uri = URI("#{base_uri}#{path}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == "https"
    http.open_timeout = 5
    http.read_timeout = 60

    req = request_class(method).new(uri)
    req["Content-Type"] = rack_request.content_type if rack_request.content_type.present?
    req["Cookie"] = rack_request.headers["Cookie"] if rack_request.headers["Cookie"].present?
    req["X-Forwarded-For"] = rack_request.remote_ip
    req["X-Forwarded-Proto"] = rack_request.ssl? ? "https" : "http"
    req.body = body if body.present? && req.request_body_permitted?

    http.request(req)
  end

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
