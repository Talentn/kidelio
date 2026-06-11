class ProductReview < ApplicationRecord
  belongs_to :product
  belongs_to :user, optional: true

  validates :stars, presence: true, inclusion: { in: 1..5 }
  validates :user_id, uniqueness: { scope: :product_id }, allow_nil: true
  validates :ip_address, uniqueness: { scope: :product_id }, allow_nil: true
  validate :user_or_ip_present

  scope :for_visitor, ->(user:, ip:) {
    if user
      where(user_id: user.id)
    else
      where(user_id: nil, ip_address: ip)
    end
  }

  private

  def user_or_ip_present
    return if user_id.present? || ip_address.present?

    errors.add(:base, "utilisateur ou adresse IP requis")
  end
end
