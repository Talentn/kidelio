class ProductColorSize < ApplicationRecord
  include Auditable
  audit_as "ProductColorSize"

  belongs_to :product_color

  validates :size, presence: true
  validates :stock, numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validates :size, uniqueness: { scope: :product_color_id, message: "existe déjà pour cette couleur" }

  scope :ordered, -> { order(:position, :size) }

  def audit_label
    c = product_color
    "#{c.product.name} — #{c.name} (taille #{size})"
  end
end
