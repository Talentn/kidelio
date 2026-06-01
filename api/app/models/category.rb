class Category < ApplicationRecord
  include Auditable
  audit_as "Category"

  belongs_to :parent, class_name: "Category", optional: true
  has_many :children,
           -> { order(:position, :name) },
           class_name: "Category",
           foreign_key: :parent_id,
           dependent: :restrict_with_error,
           inverse_of: :parent
  has_many :products, dependent: :restrict_with_error
  has_one_attached :image

  validates :name, :slug, presence: true
  validates :slug, uniqueness: true
  validate :parent_must_be_root_category
  validate :cannot_be_own_parent

  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:position, :name) }
  scope :roots, -> { where(parent_id: nil) }

  def root?
    parent_id.nil?
  end

  def subcategory?
    parent_id.present?
  end

  # IDs used when filtering products by this category in the shop.
  def product_scope_ids
    if children.loaded? ? children.any? : children.exists?
      child_ids = children.active.pluck(:id)
      child_ids.presence || [ -1 ]
    else
      [ id ]
    end
  end

  def audit_label
    subcategory? ? "#{parent&.name} › #{name}" : name
  end

  private

  def parent_must_be_root_category
    return if parent_id.blank?

    if parent_id == id
      errors.add(:parent_id, "invalide")
      return
    end

    parent_record = parent || Category.find_by(id: parent_id)
    return unless parent_record

    if parent_record.parent_id.present?
      errors.add(:parent_id, "doit être une catégorie principale (pas une sous-catégorie)")
    end

    if children.exists?
      errors.add(:parent_id, "impossible : cette catégorie contient déjà des sous-catégories")
    end
  end

  def cannot_be_own_parent
    errors.add(:parent_id, "ne peut pas être elle-même") if parent_id.present? && parent_id == id
  end
end
