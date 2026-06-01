class HomePageAsset < ApplicationRecord
  include Auditable
  audit_as "HomePageAsset"

  KEYS = %w[hero_fallback banner_collection banner_babies banner_toys].freeze

  LABELS = {
    "hero_fallback" => "Hero principal (sans carousel)",
    "banner_collection" => "Bannière collection",
    "banner_babies" => "Bannière bébés",
    "banner_toys" => "Bannière jouets"
  }.freeze

  has_one_attached :image

  validates :key, presence: true, uniqueness: true, inclusion: { in: KEYS }

  def self.for(key)
    find_or_create_by!(key: key.to_s)
  end

  def audit_label
    LABELS[key] || key
  end
end
