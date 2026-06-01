class ContactMessage < ApplicationRecord
  include Auditable
  audit_as "ContactMessage"

  validates :name, :email, :message, presence: true

  def audit_label
    "#{name} (#{email})"
  end
end
