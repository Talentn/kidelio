class ClientActivityEvent < ApplicationRecord
  belongs_to :user, optional: true
  belongs_to :product, optional: true

  EVENT_TYPES = %w[
    page_view page_leave product_view search checkout_start
    favorite_add favorite_remove
  ].freeze

  validates :session_id, :event_type, presence: true
  validates :event_type, inclusion: { in: EVENT_TYPES }

  scope :in_range, ->(from, to) { where(created_at: from..to) if from && to }
end
