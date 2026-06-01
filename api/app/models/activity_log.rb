class ActivityLog < ApplicationRecord
  belongs_to :user, optional: true

  ACTIONS = %w[CREATE UPDATE DELETE STATUS_CHANGE LOGIN LOGOUT].freeze

  validates :action, :entity_type, presence: true
end
