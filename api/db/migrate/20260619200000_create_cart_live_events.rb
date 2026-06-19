class CreateCartLiveEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :cart_live_events do |t|
      t.references :user, foreign_key: true, null: true
      t.references :product, foreign_key: true, null: true
      t.string :session_id, null: false
      t.string :action, null: false
      t.string :product_name
      t.integer :quantity, default: 1, null: false
      t.decimal :price, precision: 10, scale: 3
      t.integer :color_id
      t.string :color_label
      t.string :size_label
      t.string :ip_address
      t.string :user_agent
      t.timestamps
    end

    add_index :cart_live_events, :created_at
    add_index :cart_live_events, :session_id
    add_index :cart_live_events, :action
  end
end
