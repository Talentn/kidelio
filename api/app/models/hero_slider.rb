class HeroSlider < ApplicationRecord
  include Auditable
  audit_as "HeroSlider"

  has_one_attached :image

  scope :active, -> { where(active: true).order(:position) }

  def audit_label
    title.presence || "Slide ##{id || 'nouveau'}"
  end
end
