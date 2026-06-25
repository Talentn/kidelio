class HomePageAsset < ApplicationRecord
  include Auditable
  audit_as "HomePageAsset"

  KEYS = %w[hero_fallback banner_collection banner_babies banner_toys].freeze

  LABELS = {
    "hero_fallback" => "Image hero (page d'accueil, sans carousel)",
    "banner_collection" => "Bannière « Mode Femme » (grande tuile)",
    "banner_babies" => "Bannière « Robes » (tuile)",
    "banner_toys" => "Bannière « Enfant » (tuile)"
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
