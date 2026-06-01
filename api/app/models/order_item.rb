class OrderItem < ApplicationRecord
  belongs_to :order
  belongs_to :product, optional: true

  validates :product_name, :unit_price, :quantity, presence: true
  validates :quantity, numericality: { greater_than: 0 }
end
