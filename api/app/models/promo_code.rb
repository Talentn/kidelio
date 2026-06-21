class PromoCode < ApplicationRecord
  include Auditable
  audit_as "PromoCode"

  belongs_to :user, optional: true

  enum :discount_type, { percentage: 0, fixed: 1 }

  validates :code, :discount_value, presence: true
  validates :code, uniqueness: { case_sensitive: false }
  validates :discount_value, numericality: { greater_than: 0 }

  before_validation :normalize_code

  scope :active, -> { where(active: true).where("expires_at IS NULL OR expires_at > ?", Time.current) }

  def apply_to(subtotal, for_user: nil, customer: {})
    return 0.to_d unless usable?(for_user: for_user, customer: customer)

    amount = if percentage?
      subtotal * (discount_value / 100)
    else
      discount_value
    end
    amount = [amount, max_discount].min if max_discount.present?
    [amount, subtotal].min
  end

  def usable?(for_user: nil, customer: {})
    return false unless active? && (expires_at.nil? || expires_at > Time.current)
    return false if usage_limit.present? && used_count >= usage_limit
    return false if user_id.present? && (for_user.blank? || user_id != for_user.id)
    return false if once_per_customer? && customer_already_used?(for_user: for_user, customer: customer)

    true
  end

  def customer_already_used?(for_user: nil, customer: {})
    ctx = customer.to_h.symbolize_keys
    PromoCodeCustomerUsage.already_used?(
      promo_code: code,
      user: for_user,
      **ctx.slice(
        :guest_name, :guest_phone,
        :shipping_governorate, :shipping_delegation, :shipping_address
      )
    )
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
