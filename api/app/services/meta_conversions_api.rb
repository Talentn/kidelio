# Meta Conversions API (server-side pixel)
#
# Sends events directly from Rails to Meta's Graph API, bypassing the browser.
# This means events can't be blocked by ad blockers or iOS privacy settings.
#
# Runs alongside the browser pixel — Meta deduplicates using event_id.
#
# Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
class MetaConversionsApi
  GRAPH_VERSION = "v19.0"
  GRAPH_BASE    = "https://graph.facebook.com"
  CURRENCY      = "TND"
  SITE_URL      = -> { ENV.fetch("SITE_URL", "http://localhost:3000") }

  # @param request [ActionDispatch::Request, nil]
  def initialize(request: nil)
    @pixel_id         = ENV["META_PIXEL_ID"].to_s.strip
    @access_token     = ENV["META_ACCESS_TOKEN"].to_s.strip
    @test_event_code  = ENV["META_TEST_EVENT_CODE"].to_s.strip.presence
    @request          = request
  end

  # ── public event methods ──────────────────────────────────────────────────

  def track_purchase(order:)
    return unless configured?

    items        = order.order_items.includes(:product)
    content_ids  = items.map { |i| i.product_id.to_s }
    num_items    = items.sum(&:quantity)

    send_event(
      event_name:       "Purchase",
      event_id:         order.order_number,   # matches browser event_id for dedup
      event_source_url: "#{SITE_URL.call}/commande/#{order.order_number}",
      user_data:        user_data_from_order(order),
      custom_data: {
        currency:        CURRENCY,
        value:           order.total.to_f.round(3),
        content_ids:     content_ids,
        content_type:    "product",
        num_items:       num_items,
        order_id:        order.order_number,
      }
    )
  end

  def track_add_to_cart(product:, quantity:, price:, request: nil)
    return unless configured?

    req = request || @request
    send_event(
      event_name:       "AddToCart",
      event_id:         "atc-#{product.id}-#{Time.current.to_i}",
      event_source_url: "#{SITE_URL.call}/produits/#{product.slug}",
      user_data:        user_data_from_request(req),
      custom_data: {
        currency:     CURRENCY,
        value:        (price.to_f * quantity).round(3),
        content_ids:  [product.id.to_s],
        content_type: "product",
        content_name: product.name,
        num_items:    quantity,
      }
    )
  end

  def track_view_content(product:, request: nil)
    return unless configured?

    req = request || @request
    send_event(
      event_name:       "ViewContent",
      event_id:         "vc-#{product.id}-#{Time.current.to_i}",
      event_source_url: "#{SITE_URL.call}/produits/#{product.slug}",
      user_data:        user_data_from_request(req),
      custom_data: {
        currency:          CURRENCY,
        value:             product.effective_price.to_f.round(3),
        content_ids:       [product.id.to_s],
        content_type:      "product",
        content_name:      product.name,
        content_category:  product.category&.name.to_s,
      }
    )
  end

  # ── private ───────────────────────────────────────────────────────────────
  private

  def configured?
    @pixel_id.present? && @access_token.present?
  end

  def send_event(event_name:, event_id:, event_source_url:, user_data:, custom_data:)
    payload = {
      data: [
        {
          event_name:       event_name,
          event_time:       Time.current.to_i,
          event_id:         event_id,
          event_source_url: event_source_url,
          action_source:    "website",
          user_data:        user_data.compact,
          custom_data:      custom_data,
        }
      ]
    }
    payload[:test_event_code] = @test_event_code if @test_event_code.present?

    uri  = URI("#{GRAPH_BASE}/#{GRAPH_VERSION}/#{@pixel_id}/events")
    uri.query = URI.encode_www_form(access_token: @access_token)

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.read_timeout = 5
    http.open_timeout = 5

    req = Net::HTTP::Post.new(uri)
    req["Content-Type"] = "application/json"
    req.body = payload.to_json

    http.request(req)
  rescue StandardError => e
    Rails.logger.warn("[MetaConversionsApi] Failed to send #{event_name}: #{e.message}")
  end

  # ── user data builders ────────────────────────────────────────────────────

  # For Purchase — we have the order's phone/email/name
  def user_data_from_order(order)
    data = user_data_from_request(@request)
    data[:em] = [hash(order.guest_email)]  if order.guest_email.present?
    data[:ph] = [hash(order.guest_phone)]  if order.guest_phone.present?
    data[:fn] = [hash(order.guest_name.split.first)] if order.guest_name.present?
    data[:ln] = [hash(order.guest_name.split.last)]  if order.guest_name.to_s.split.size > 1
    data[:ct] = [hash(order.shipping_governorate)]   if order.shipping_governorate.present?
    data[:country] = [hash("tn")]
    data
  end

  # For other events — only request metadata
  def user_data_from_request(req)
    return {} unless req

    data = {}
    data[:client_ip_address] = req.remote_ip if req.remote_ip.present?
    data[:client_user_agent] = req.user_agent if req.user_agent.present?

    # Read Meta's own cookies (_fbp set by pixel, _fbc set on ad click)
    data[:fbp] = req.cookies["_fbp"] if req.cookies["_fbp"].present?
    data[:fbc] = req.cookies["_fbc"] if req.cookies["_fbc"].present?

    data
  end

  # SHA-256 hash as required by Meta for PII
  def hash(value)
    Digest::SHA256.hexdigest(value.to_s.downcase.strip)
  end
end
