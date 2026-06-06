class RecalculateLoyaltyFromDeliveredOrders < ActiveRecord::Migration[7.2]
  def up
    Order.where(loyalty_counted: true).where.not(status: "delivered").update_all(loyalty_counted: false)

    user_ids = Order.where.not(user_id: nil).distinct.pluck(:user_id)
    User.where(id: user_ids).find_each do |user|
      delivered = Order.where(user_id: user.id, status: "delivered")
      progress = delivered.sum(:subtotal)
      user.update_column(:loyalty_spend_progress, progress)
      Order.where(user_id: user.id).where.not(status: "delivered").update_all(loyalty_counted: false)
      delivered.update_all(loyalty_counted: true)
    end
  end

  def down
    # Irreversible — previous progress mixed order statuses
  end
end
