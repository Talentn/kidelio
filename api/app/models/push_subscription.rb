class PushSubscription < ApplicationRecord
  belongs_to :user, optional: true

  validates :endpoint, :p256dh, :auth, presence: true
  validates :endpoint, uniqueness: true

  EVENT_FLAGS = {
    "order"   => :notify_orders,
    "chat"    => :notify_chat,
    "message" => :notify_messages
  }.freeze

  scope :for_event, ->(event) { where(EVENT_FLAGS.fetch(event.to_s) => true) }
end
