class CreatePushSubscriptions < ActiveRecord::Migration[8.1]
  def change
    # One row per staff device/browser subscribed to Web Push notifications.
    create_table :push_subscriptions do |t|
      t.integer :user_id
      t.string :endpoint, null: false
      t.string :p256dh, null: false
      t.string :auth, null: false
      t.boolean :notify_orders, default: true, null: false
      t.boolean :notify_chat, default: true, null: false
      t.boolean :notify_messages, default: true, null: false
      t.timestamps
    end
    add_index :push_subscriptions, :endpoint, unique: true
    add_index :push_subscriptions, :user_id
  end
end
