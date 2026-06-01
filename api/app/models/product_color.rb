class ProductColor < ApplicationRecord
  include Auditable
  audit_as "ProductColor"

  belongs_to :product
  has_many :sizes, -> { ordered }, class_name: "ProductColorSize", dependent: :destroy
  has_many_attached :images

  validates :name, presence: true

  scope :ordered, -> { order(:position, :id) }

  def audit_label
    "#{product.name} — #{name}"
  end

  # Total stock across all sizes, or nil when no sizes are defined.
  def total_stock
    sizes.any? ? sizes.sum(:stock) : nil
  end
end
