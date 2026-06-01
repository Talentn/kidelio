module OrderTrackingJson
  extend ActiveSupport::Concern

  STATUS_LABELS = {
    "pending" => "Commande reçue",
    "confirmed" => "Confirmée",
    "processing" => "En préparation",
    "shipped" => "Expédiée",
    "out_for_delivery" => "En cours de livraison",
    "delivered" => "Livrée",
    "cancelled" => "Annulée",
    "refunded" => "Remboursée"
  }.freeze

  TIMELINE_STATUSES = %w[pending confirmed processing shipped out_for_delivery delivered].freeze

  private

  def order_track_json(order, detailed: false)
    json = {
      order_number: order.order_number,
      status: order.status,
      status_label: STATUS_LABELS[order.status] || "Statut inconnu",
      created_at: order.created_at,
      total: order.total,
      timeline: build_timeline(order),
      items_count: order.order_items.sum(:quantity)
    }

    if detailed
      json.merge!(
        subtotal: order.subtotal,
        shipping_cost: order.shipping_cost,
        discount_amount: order.discount_amount,
        payment_method: order.payment_method,
        shipping: {
          governorate: order.shipping_governorate,
          delegation: order.shipping_delegation,
          address: order.shipping_address,
          postal_code: order.shipping_postal_code
        },
        items: order.order_items.map do |i|
          {
            product_name: i.product_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            size_label: i.size_label,
            color_label: i.color_label
          }
        end
      )
    else
      json[:shipping] = {
        governorate: order.shipping_governorate,
        delegation: order.shipping_delegation
      }
    end

    json
  end

  def build_timeline(order)
    current_index = TIMELINE_STATUSES.index(order.status)
    current_index = TIMELINE_STATUSES.length - 1 if order.delivered?
    current_index = nil if order.cancelled? || order.refunded?

    TIMELINE_STATUSES.map.with_index do |status, idx|
      done = current_index.nil? ? false : idx <= current_index
      active = current_index == idx
      {
        status: status,
        label: STATUS_LABELS[status],
        done: done,
        active: active
      }
    end
  end
end
