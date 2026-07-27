# HTTP client for IntiGo Partner V3 API.
# Docs: https://api.intigo.net/swagger
class IntigoClient
  class Error < StandardError
    attr_reader :status, :body

    def initialize(message, status: nil, body: nil)
      super(message)
      @status = status
      @body = body
    end
  end

  BASE_URL = ENV.fetch("INTIGO_API_URL", "https://api.intigo.net/api/v3").freeze

  def initialize(api_key: ENV["INTIGO_API_KEY"])
    @api_key = api_key.to_s.strip
  end

  def configured?
    @api_key.present?
  end

  def cities
    get("/regions/cities").fetch("cities", [])
  end

  def districts(city_id)
    get("/regions/cities/#{city_id}/districts").fetch("districts", [])
  end

  def pickup_addresses
    get("/pickup-addresses/").fetch("pickup_addresses", [])
  end

  def create_parcel(payload)
    post("/parcels/", payload)
  end

  def parcel(nid)
    get("/parcels/#{nid}").fetch("parcel", {})
  end

  # Full parcel timeline → [{ "type", "timestamp", "data" }]. Event types:
  # status_change, delivery_attempt, scan, address_change, phone_change, partner_action.
  def parcel_history(nid)
    get("/parcels/#{nid}/history").fetch("history", [])
  end

  # Bulk status for up to 200 NIDs → [{ "nid", "found", "status", "status_label" }]
  def parcels_status(nids)
    post("/parcels/status", { nids: Array(nids) }).fetch("parcels", [])
  end

  # Re-delivery request via IVR (only for Intigo status 2100).
  # Raises Error with status 402 when a relance fee must be accepted first.
  def relance_parcel(nid, accept_fee: false)
    post("/parcels/#{nid}/relance", { accept_fee: accept_fee })
  end

  # Change delivery address on an existing parcel (allowed while status < 5000).
  def change_parcel_address(nid, address:, city_id: nil, district_id: nil)
    payload = { address: address }
    payload[:city_id] = city_id if city_id.present?
    payload[:district_id] = district_id if district_id.present?
    post("/parcels/#{nid}/change-address", payload)
  end

  # Change delivery phone on an existing parcel (allowed while status < 5000).
  def change_parcel_phone(nid, phone)
    post("/parcels/#{nid}/change-phone", { phone: phone })
  end

  # Change COD price on an existing parcel (allowed while status < 5000).
  def change_parcel_price(nid, price)
    post("/parcels/#{nid}/change-price", { price: price })
  end

  # Partial update of a parcel (only allowed in pickup status 1000).
  # Accepts can_open, is_exchange, description, package_size, etc.
  def update_parcel(nid, attrs)
    patch("/parcels/#{nid}", attrs.compact)
  end

  # Printable bordereau page for up to 50 parcels → URL string.
  def bordereau_url(nids)
    response = post("/parcels/bordereau", { nids: Array(nids) })
    return response if response.is_a?(String)

    response["url"] || response["bordereau_url"] || response["link"]
  end

  private

  def get(path)
    request(Net::HTTP::Get, path)
  end

  def post(path, payload)
    request(Net::HTTP::Post, path, payload)
  end

  def patch(path, payload)
    request(Net::HTTP::Patch, path, payload)
  end

  def request(klass, path, payload = nil)
    raise Error, "INTIGO_API_KEY manquante" unless configured?

    uri = URI.join("#{BASE_URL}/", path.delete_prefix("/"))
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == "https"
    http.open_timeout = 10
    http.read_timeout = 30

    req = klass.new(uri)
    req["X-API-Key"] = @api_key
    req["Content-Type"] = "application/json"
    req["Accept"] = "application/json"
    req.body = payload.to_json if payload

    res = http.request(req)
    parse_response(res)
  rescue Error
    raise
  rescue StandardError => e
    raise Error, "Intigo réseau: #{e.message}"
  end

  def parse_response(res)
    body = res.body.to_s
    json = body.present? ? JSON.parse(body) : {}

    unless res.is_a?(Net::HTTPSuccess)
      detail = json["detail"] || json["message"] || json["error"] || body.presence || res.message
      detail = detail.join(", ") if detail.is_a?(Array)
      raise Error.new(detail.to_s, status: res.code.to_i, body: json)
    end

    json
  rescue JSON::ParserError
    raise Error.new("Réponse Intigo invalide (HTTP #{res.code})", status: res.code.to_i, body: body)
  end
end
