class User < ApplicationRecord
  include Auditable
  audit_as "User"

  devise :database_authenticatable, :omniauthable, omniauth_providers: [ :google_oauth2 ]

  enum :role, { client: 0, employee: 1, admin: 2 }

  has_many :addresses, dependent: :destroy
  has_many :orders, dependent: :nullify
  has_many :activity_logs, dependent: :nullify

  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :name, presence: true
  validates :password, presence: true, length: { minimum: 8 }, if: :password_required?
  validates :uid, uniqueness: { scope: :provider }, allow_nil: true

  normalizes :email, with: ->(e) { e.strip.downcase }

  def staff?
    employee? || admin?
  end

  def self.from_omniauth(auth)
    email = auth.info.email&.strip&.downcase
    raise "Email Google requis" if email.blank?

    user = find_by(provider: auth.provider, uid: auth.uid)
    user ||= find_by(email: email)
    user ||= new(provider: auth.provider, uid: auth.uid, email: email, role: :client)

    user.provider ||= auth.provider
    user.uid ||= auth.uid
    user.name = auth.info.name.presence || user.name || email.split("@").first
    user.password = Devise.friendly_token[0, 20] if user.encrypted_password.blank?
    user.save!
    user
  end

  private

  def password_required?
    encrypted_password.blank? && provider.blank?
  end
end
