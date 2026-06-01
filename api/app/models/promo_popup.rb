class PromoPopup < ApplicationRecord
  include Auditable
  audit_as "PromoPopup"

  has_one_attached :image

  validates :title, length: { maximum: 120 }, allow_blank: true

  scope :active, -> { where(active: true).order(:position, :id) }

  def audit_label
    title.presence || "Bannière ##{id || 'nouvelle'}"
  end
end
