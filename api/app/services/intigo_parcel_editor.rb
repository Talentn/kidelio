# Pushes admin edits of an order (delivery address / phone) to the existing
# Intigo parcel. Failures never block the local save — they are returned as
# warnings and stored in intigo_last_error for visibility.
class IntigoParcelEditor
  ADDRESS_FIELDS = %w[
    shipping_address shipping_governorate shipping_delegation
    intigo_city_id intigo_district_id
  ].freeze

  # Parcel options only editable while the parcel is in pickup (Intigo 1000).
  FLAG_FIELDS = %w[intigo_can_open intigo_is_exchange].freeze

  def initialize(order, client: IntigoClient.new)
    @order = order
    @client = client
  end

  # previous_changes: ActiveModel dirty hash captured after order.save.
  # Returns an array of warning messages (empty when everything synced).
  def push_changes(previous_changes)
    return [] if @order.intigo_nid.blank?

    address_changed = ADDRESS_FIELDS.any? { |f| previous_changes.key?(f) }
    phone_changed = previous_changes.key?("guest_phone")
    price_changed = previous_changes.key?("total") && @order.payment_method.to_s == "cash"
    flags_changed = FLAG_FIELDS.any? { |f| previous_changes.key?(f) }
    return [] unless address_changed || phone_changed || price_changed || flags_changed
    return [ "INTIGO_API_KEY manquante — colis Intigo non mis à jour" ] unless @client.configured?

    warnings = []
    warnings.concat(push_address) if address_changed
    warnings.concat(push_phone) if phone_changed
    warnings.concat(push_price) if price_changed
    warnings.concat(push_flags) if flags_changed

    if warnings.any?
      @order.update_columns(intigo_last_error: warnings.join(" | ").truncate(2000), updated_at: Time.current)
    end
    warnings
  end

  private

  def push_address
    @client.change_parcel_address(
      @order.intigo_nid,
      address: @order.shipping_address.to_s.truncate(500),
      city_id: @order.intigo_city_id,
      district_id: @order.intigo_district_id
    )
    []
  rescue IntigoClient::Error => e
    [ "Adresse non mise à jour sur Intigo : #{e.message}" ]
  end

  def push_phone
    @client.change_parcel_phone(@order.intigo_nid, IntigoPhone.normalize!(@order.guest_phone))
    []
  rescue IntigoClient::Error, IntigoPhone::Error => e
    [ "Téléphone non mis à jour sur Intigo : #{e.message}" ]
  end

  def push_price
    @client.change_parcel_price(@order.intigo_nid, @order.total.to_d.round(3))
    []
  rescue IntigoClient::Error => e
    [ "Prix COD non mis à jour sur Intigo : #{e.message}" ]
  end

  def push_flags
    @client.update_parcel(
      @order.intigo_nid,
      can_open: @order.intigo_can_open,
      is_exchange: @order.intigo_is_exchange
    )
    []
  rescue IntigoClient::Error => e
    [ "Options du colis non mises à jour sur Intigo (modifiables uniquement avant enlèvement) : #{e.message}" ]
  end
end
