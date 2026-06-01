class Order < ApplicationRecord
  include Auditable
  audit_as "Order"

  belongs_to :user, optional: true
  has_many :order_items, dependent: :destroy

  enum :status, {
    pending: 0,
    confirmed: 1,
    processing: 2,
    shipped: 3,
    out_for_delivery: 4,
    delivered: 5,
    cancelled: 6,
    refunded: 7
  }

  SHIPPING_COST = 7.to_d
  FREE_SHIPPING_THRESHOLD = 200.to_d

  validates :order_number, :shipping_governorate, :shipping_delegation,
            :shipping_address, :subtotal, :shipping_cost, :total, presence: true

  before_validation :assign_order_number, on: :create

  def self.calculate_shipping(subtotal)
    subtotal >= FREE_SHIPPING_THRESHOLD ? 0.to_d : SHIPPING_COST
  end

  private

  def assign_order_number
    self.order_number ||= "KS-#{Time.current.strftime('%Y%m%d')}-#{SecureRandom.hex(4).upcase}"
  end
end
