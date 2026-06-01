class Address < ApplicationRecord
  belongs_to :user

  validates :full_name, :phone, :governorate, :delegation, :street_address, presence: true

  scope :ordered, -> { order(is_default: :desc, updated_at: :desc) }

  def self.sync_from_orders!(user)
    user.orders.order(created_at: :desc).find_each do |order|
      upsert_from_shipping!(
        user,
        full_name: order.guest_name,
        phone: order.guest_phone,
        governorate: order.shipping_governorate,
        delegation: order.shipping_delegation,
        street_address: order.shipping_address,
        postal_code: order.shipping_postal_code
      )
    end
  end

  def self.upsert_from_shipping!(user, attrs)
    normalized = attrs.stringify_keys
    return if normalized["governorate"].blank? || normalized["street_address"].blank?

    existing = user.addresses.find do |a|
      a.governorate == normalized["governorate"] &&
        a.delegation == normalized["delegation"] &&
        a.street_address == normalized["street_address"] &&
        a.phone == normalized["phone"]
    end

    if existing
      existing.update!(
        full_name: normalized["full_name"].presence || existing.full_name,
        postal_code: normalized["postal_code"].presence || existing.postal_code
      )
      existing
    else
      user.addresses.create!(
        full_name: normalized["full_name"].presence || user.name,
        phone: normalized["phone"].presence || user.phone.to_s,
        governorate: normalized["governorate"],
        delegation: normalized["delegation"],
        street_address: normalized["street_address"],
        postal_code: normalized["postal_code"],
        label: "Adresse #{user.addresses.count + 1}"
      )
    end
  end
end
