class CreateKidsShopSchema < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :password_digest, null: false
      t.string :name, null: false
      t.string :phone
      t.integer :role, null: false, default: 0
      t.integer :fidelity_points, null: false, default: 0
      t.timestamps
    end
    add_index :users, :email, unique: true

    create_table :categories do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.text :description
      t.integer :position, default: 0
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_index :categories, :slug, unique: true

    create_table :products do |t|
      t.references :category, foreign_key: true
      t.string :name, null: false
      t.string :slug, null: false
      t.string :reference
      t.text :description
      t.decimal :price, precision: 10, scale: 3, null: false
      t.decimal :promo_price, precision: 10, scale: 3
      t.integer :stock, null: false, default: 0
      t.boolean :active, null: false, default: true
      t.boolean :featured, null: false, default: false
      t.boolean :on_promo, null: false, default: false
      t.string :age_group
      t.timestamps
    end
    add_index :products, :slug, unique: true
    add_index :products, :reference, unique: true

    create_table :hero_sliders do |t|
      t.string :title
      t.string :subtitle
      t.string :link_url
      t.integer :position, default: 0
      t.boolean :active, null: false, default: true
      t.timestamps
    end

    create_table :promo_codes do |t|
      t.string :code, null: false
      t.integer :discount_type, null: false, default: 0
      t.decimal :discount_value, precision: 10, scale: 3, null: false
      t.decimal :min_order_amount, precision: 10, scale: 3
      t.decimal :max_discount, precision: 10, scale: 3
      t.integer :usage_limit
      t.integer :used_count, null: false, default: 0
      t.boolean :active, null: false, default: true
      t.datetime :expires_at
      t.timestamps
    end
    add_index :promo_codes, :code, unique: true

    create_table :addresses do |t|
      t.references :user, null: false, foreign_key: true
      t.string :label
      t.string :full_name, null: false
      t.string :phone, null: false
      t.string :governorate, null: false
      t.string :delegation, null: false
      t.string :street_address, null: false
      t.string :postal_code
      t.boolean :is_default, null: false, default: false
      t.timestamps
    end

    create_table :orders do |t|
      t.references :user, foreign_key: true
      t.string :order_number, null: false
      t.string :guest_name
      t.string :guest_phone
      t.string :guest_email
      t.string :shipping_governorate, null: false
      t.string :shipping_delegation, null: false
      t.string :shipping_address, null: false
      t.string :shipping_postal_code
      t.decimal :subtotal, precision: 10, scale: 3, null: false
      t.decimal :shipping_cost, precision: 10, scale: 3, null: false, default: 7
      t.decimal :discount_amount, precision: 10, scale: 3, null: false, default: 0
      t.decimal :total, precision: 10, scale: 3, null: false
      t.string :promo_code
      t.integer :status, null: false, default: 0
      t.string :payment_method, null: false, default: "cash"
      t.text :notes
      t.timestamps
    end
    add_index :orders, :order_number, unique: true

    create_table :order_items do |t|
      t.references :order, null: false, foreign_key: true
      t.references :product, foreign_key: true
      t.string :product_name, null: false
      t.string :product_slug
      t.decimal :unit_price, precision: 10, scale: 3, null: false
      t.integer :quantity, null: false
      t.string :size_label
      t.string :color_label
      t.timestamps
    end

    create_table :activity_logs do |t|
      t.references :user, foreign_key: true
      t.string :action, null: false
      t.string :entity_type, null: false
      t.string :entity_id
      t.string :entity_name
      t.json :changes, default: {}
      t.string :ip_address
      t.string :user_agent
      t.timestamps
    end
    add_index :activity_logs, :created_at
    add_index :activity_logs, [:entity_type, :entity_id]

    create_table :contact_messages do |t|
      t.string :name, null: false
      t.string :email, null: false
      t.string :phone
      t.text :message, null: false
      t.boolean :read, null: false, default: false
      t.timestamps
    end
  end
end
