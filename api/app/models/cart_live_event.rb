class CartLiveEvent < ApplicationRecord
  belongs_to :user, optional: true
  belongs_to :product, optional: true

  ACTIONS = %w[add remove update clear].freeze

  validates :session_id, :action, presence: true
  validates :action, inclusion: { in: ACTIONS }
end
