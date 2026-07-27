# Pulls parcel statuses from Intigo and mirrors them on orders.
#
# Intigo status code families:
#   1000       pickup created (awaiting pickup)
#   1100       pickup cancelled (annulé par Intigo)
#   2xxx/3xxx  warehouse / transfer (2001 relance, 2100 échec livraison → relançable)
#   4xxx       out for delivery
#   5xxx       delivered
#   6xxx       return to sender
#
# Forward statuses are mapped onto the local order status (never backwards,
# never auto-cancel — cancellations/returns are surfaced for the admin to act).
class IntigoStatusSync
  class Error < StandardError; end

  RELANCE_STATUS = 2100
  STATUS_RANK = {
    "pending" => 0,
    "confirmed" => 1,
    "processing" => 2,
    "shipped" => 3,
    "out_for_delivery" => 4,
    "delivered" => 5
  }.freeze

  BATCH_SIZE = 200
  MAX_ORDERS_PER_RUN = 600

  def initialize(client: IntigoClient.new)
    @client = client
  end

  def sync_order!(order)
    raise Error, "INTIGO_API_KEY manquante" unless @client.configured?
    raise Error, "Aucun colis Intigo pour cette commande" if order.intigo_nid.blank?

    parcel = @client.parcel(order.intigo_nid)
    # Intigo exposes the client-contact / delivery attempt count as
    # delivery_attempts (V3 detail) or nbTentative (legacy list/summary).
    attempts = parcel["delivery_attempts"]
    attempts = parcel["nbTentative"] if attempts.nil?
    apply!(order, parcel["status"], parcel["status_label"], attempts: attempts)
    order
  rescue IntigoClient::Error => e
    order.update_columns(intigo_last_error: e.message.truncate(2000), updated_at: Time.current)
    raise Error, e.message
  end

  # Sync every order that has a parcel not yet delivered. Returns { synced: n }.
  def sync_all!
    raise Error, "INTIGO_API_KEY manquante" unless @client.configured?

    orders = Order
      .where.not(intigo_nid: [ nil, "" ])
      .where.not(status: %w[cancelled refunded])
      .where("intigo_status IS NULL OR intigo_status < 5000")
      .order(created_at: :desc)
      .limit(MAX_ORDERS_PER_RUN)
      .to_a

    synced = 0
    orders.each_slice(BATCH_SIZE) do |batch|
      by_nid = batch.index_by(&:intigo_nid)
      @client.parcels_status(by_nid.keys).each do |item|
        next unless item["found"]

        order = by_nid[item["nid"].to_s]
        next unless order

        apply!(order, item["status"], item["status_label"])
        synced += 1
      end
    end

    { synced: synced }
  rescue IntigoClient::Error => e
    raise Error, e.message
  end

  private

  # attempts is only available on the single-parcel endpoint; the bulk status
  # endpoint doesn't return it, so nil means "keep the stored value".
  def apply!(order, code, label, attempts: nil)
    code = code&.to_i
    order.assign_attributes(
      intigo_status: code,
      intigo_status_label: label,
      intigo_synced_at: Time.current
    )
    order.intigo_delivery_attempts = attempts.to_i unless attempts.nil?

    new_status = local_status_for(code)
    current_rank = STATUS_RANK[order.status]
    if new_status && current_rank && STATUS_RANK[new_status] > current_rank
      previous_status = order.status
      order.status = new_status
      order.save!
      OrderStatusSideEffects.apply!(order, previous_status)
    else
      order.save!
    end
  end

  # 1100 (annulé), 6xxx (retour) and 99 (reroute) are shown to the admin but
  # never change the local status automatically.
  def local_status_for(code)
    case code
    when 1000..1099 then "processing"
    when 2000..3999 then "shipped"
    when 4000..4999 then "out_for_delivery"
    when 5000..5999 then "delivered"
    end
  end
end
