class CreateClientActivityEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :client_activity_events do |t|
      t.references :user, foreign_key: true, null: true
      t.references :product, foreign_key: true, null: true
      t.string :session_id, null: false
      t.string :event_type, null: false
      t.string :path
      t.string :product_name
      t.json :metadata, default: {}
      t.string :ip_address
      t.string :user_agent
      t.timestamps
    end

    add_index :client_activity_events, :created_at
    add_index :client_activity_events, [ :event_type, :created_at ]
    add_index :client_activity_events, :session_id
  end
end
