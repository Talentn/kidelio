class Product < ApplicationRecord
  include Auditable
  audit_as "Product"

  belongs_to :category, optional: true
  has_many :order_items, dependent: :nullify
  has_many :colors, -> { ordered }, class_name: "ProductColor", dependent: :destroy
  has_many_attached :images

  validates :name, :slug, :price, presence: true
  validates :slug, uniqueness: true
  validates :stock, numericality: { greater_than_or_equal_to: 0 }
  validates :price, numericality: { greater_than: 0 }
  validate :category_must_be_leaf, if: -> { category_id.present? }

  scope :active, -> { where(active: true) }
  scope :featured, -> { where(featured: true, active: true) }
  scope :on_promo, -> { where(on_promo: true, active: true) }

  def effective_price
    on_promo && promo_price.present? ? promo_price : price
  end

  def in_stock?
    return true if stock.positive?

    colors.includes(:sizes).any? { |c| c.sizes.any? { |s| s.stock.positive? } }
  end

  # Catalog cover: product images, else the first color (by position) gallery.
  def listing_image_attachments
    return images.to_a if images.attached?

    primary_color = colors.min_by { |c| [c.position || 0, c.id] }
    return [] unless primary_color&.images&.attached?

    primary_color.images.to_a
  end

  private

  def category_must_be_leaf
    return unless category&.children&.exists?

    errors.add(:category_id, "doit être une sous-catégorie (pas une catégorie principale avec des sous-catégories)")
  end
end
