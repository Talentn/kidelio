# Creates an IntiGo parcel from an Order and stores nid / errors on the order.
class IntigoParcelCreator
  class Error < StandardError; end

  # Checkout uses French accents; Intigo city names are ASCII / slightly different.
  CITY_ALIASES = {
    "manouba" => "mannouba",
    "mannouba" => "mannouba",
    "beja" => "beja",
    "gabes" => "gabes",
    "medenine" => "medenine",
    "mednine" => "medenine",
    "lekef" => "kef",
    "elkef" => "kef"
  }.freeze

  def initialize(order, client: IntigoClient.new, force: false)
    @order = order
    @client = client
    @force = force
  end

  def call
    raise Error, "INTIGO_API_KEY manquante" unless @client.configured?
    raise Error, "Colis Intigo déjà créé (#{@order.intigo_nid})" if @order.intigo_nid.present? && !@force

    city_id, district_id = resolve_region_ids!
    pickup_index = resolve_pickup_index!

    payload = {
      recipient_name: @order.guest_name.presence || @order.user&.name.presence || "Client",
      phone1: normalize_phone(@order.guest_phone),
      destination_address: @order.shipping_address.to_s.truncate(500),
      destination_city_id: city_id,
      destination_district_id: district_id,
      price: cod_price,
      package_size: ENV.fetch("INTIGO_PACKAGE_SIZE", "1").to_i,
      description: parcel_description,
      can_open: @order.intigo_can_open,
      is_exchange: @order.intigo_is_exchange,
      cid: @order.order_number.to_s.truncate(50)
    }
    payload[:pickup_index] = pickup_index if pickup_index.present?
    payload[:client_email] = @order.guest_email if @order.guest_email.present?
    payload[:additional_info] = "Commande #{@order.order_number}"

    response = @client.create_parcel(payload)
    nid = response["nid"].presence
    raise Error, "Intigo n'a pas renvoyé de NID" if nid.blank?

    @order.update!(
      intigo_nid: nid,
      intigo_sent_at: Time.current,
      intigo_last_error: nil,
      intigo_city_id: city_id,
      intigo_district_id: district_id
    )
    @order
  rescue IntigoClient::Error, Error => e
    @order.update_columns(intigo_last_error: e.message.truncate(2000), updated_at: Time.current)
    raise Error, e.message
  end

  private

  def resolve_region_ids!
    if @order.intigo_city_id.present? && @order.intigo_district_id.present?
      return [ @order.intigo_city_id.to_i, @order.intigo_district_id.to_i ]
    end

    city = resolve_city!
    district = resolve_district!(city["id"])
    [ city["id"].to_i, district["id"].to_i ]
  end

  def cod_price
    return 0.to_d unless @order.payment_method.to_s == "cash"

    @order.total.to_d.round(3)
  end

  def parcel_description
    items = @order.order_items.map do |i|
      label = [ i.product_name, i.size_label, i.color_label ].compact_blank.join(" / ")
      "#{label} x#{i.quantity}"
    end
    (items.presence || [ "Colis" ]).join(", ").truncate(500)
  end

  def normalize_phone(phone)
    IntigoPhone.normalize!(phone)
  rescue IntigoPhone::Error => e
    raise Error, e.message
  end

  def resolve_city!
    cities = @client.cities
    target = normalize_place(@order.shipping_governorate)
    aliased = CITY_ALIASES.fetch(target, target)

    city = cities.find { |c| normalize_place(c["name"]) == aliased } ||
           cities.find { |c| place_tokens(c["name"]) == place_tokens(@order.shipping_governorate) } ||
           cities.find { |c| fuzzy_place_match?(c["name"], @order.shipping_governorate) }

    raise Error, "Ville Intigo introuvable pour « #{@order.shipping_governorate} »" unless city

    city
  end

  def resolve_district!(city_id)
    districts = @client.districts(city_id)
    raise Error, "Aucune délégation Intigo pour cette ville" if districts.empty?

    district =
      districts.find { |d| normalize_place(d["name"]) == normalize_place(@order.shipping_delegation) } ||
      districts.find { |d| place_tokens(d["name"]) == place_tokens(@order.shipping_delegation) } ||
      districts.find { |d| fuzzy_place_match?(d["name"], @order.shipping_delegation) }

    # Fallback: search all cities if the delegation belongs to another gouvernorat label.
    if district.nil?
      @client.cities.each do |city|
        next if city["id"].to_i == city_id.to_i

        found = @client.districts(city["id"]).find do |d|
          normalize_place(d["name"]) == normalize_place(@order.shipping_delegation) ||
            place_tokens(d["name"]) == place_tokens(@order.shipping_delegation) ||
            fuzzy_place_match?(d["name"], @order.shipping_delegation)
        end
        next unless found

        raise Error,
              "Délégation « #{@order.shipping_delegation} » appartient à « #{city['name']} », " \
              "pas à « #{@order.shipping_governorate} ». Corrigez le gouvernorat ou recréez la commande."
      end
    end

    raise Error, "Délégation Intigo introuvable pour « #{@order.shipping_delegation} »" unless district

    district
  end

  def resolve_pickup_index!
    if ENV["INTIGO_PICKUP_INDEX"].present?
      return ENV["INTIGO_PICKUP_INDEX"].to_i
    end

    addresses = @client.pickup_addresses
    raise Error, "Aucune adresse de pickup Intigo configurée" if addresses.empty?

    # "index" can be null in the Intigo API; pickup_index is optional in that
    # case (Intigo then uses the business default pickup address).
    addresses.filter_map { |a| a["index"] }.first&.to_i
  end

  def normalize_place(value)
    I18n.transliterate(value.to_s)
        .downcase
        .gsub(/[^a-z0-9]+/, "")
  end

  # "la marsa" / "La Marsa" / "marsa" → ["marsa"]
  def place_tokens(value)
    I18n.transliterate(value.to_s)
        .downcase
        .split(/[^a-z0-9]+/)
        .reject { |t| t.blank? || %w[la le les el al de du des].include?(t) }
  end

  def fuzzy_place_match?(left, right)
    a = normalize_place(left)
    b = normalize_place(right)
    return false if a.blank? || b.blank?
    return true if a == b || a.include?(b) || b.include?(a)

    ta = place_tokens(left).join
    tb = place_tokens(right).join
    ta.present? && tb.present? && (ta == tb || ta.include?(tb) || tb.include?(ta))
  end
end
