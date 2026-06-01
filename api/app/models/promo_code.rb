class PromoCode < ApplicationRecord
  include Auditable
  audit_as "PromoCode"

  enum :discount_type, { percentage: 0, fixed: 1 }

  validates :code, :discount_value, presence: true
  validates :code, uniqueness: { case_sensitive: false }
  validates :discount_value, numericality: { greater_than: 0 }

  before_validation :normalize_code

  scope :active, -> { where(active: true).where("expires_at IS NULL OR expires_at > ?", Time.current) }

  def apply_to(subtotal)
    return 0.to_d unless usable?

    amount = if percentage?
      subtotal * (discount_value / 100)
    else
      discount_value
    end
    amount = [amount, max_discount].min if max_discount.present?
    [amount, subtotal].min
  end

  def usable?
    active? && (expires_at.nil? || expires_at > Time.current) &&
      (usage_limit.nil? || used_count < usage_limit)
  end

  def audit_label
    code
  end

  def status_label
    return "Inactif" unless active?
    return "Expiré" if expires_at.present? && expires_at <= Time.current
    return "Épuisé" if usage_limit.present? && used_count >= usage_limit

    "Actif"
  end

  private

  def normalize_code
    self.code = code.to_s.strip.upcase if code.present?
  end
end
