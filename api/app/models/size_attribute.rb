class SizeAttribute < ApplicationRecord
  include Auditable
  audit_as "SizeAttribute"

  validates :name, presence: true, uniqueness: { case_sensitive: false }

  scope :ordered, -> { order(:position, :name) }
end
