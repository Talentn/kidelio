# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_06_19_230000) do
  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "activity_logs", force: :cascade do |t|
    t.string "action", null: false
    t.datetime "created_at", null: false
    t.json "diff", default: {}
    t.string "entity_id"
    t.string "entity_name"
    t.string "entity_type", null: false
    t.string "ip_address"
    t.datetime "updated_at", null: false
    t.string "user_agent"
    t.integer "user_id"
    t.index ["created_at"], name: "index_activity_logs_on_created_at"
    t.index ["entity_type", "entity_id"], name: "index_activity_logs_on_entity_type_and_entity_id"
    t.index ["user_id"], name: "index_activity_logs_on_user_id"
  end

  create_table "addresses", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "delegation", null: false
    t.string "full_name", null: false
    t.string "governorate", null: false
    t.boolean "is_default", default: false, null: false
    t.string "label"
    t.string "phone", null: false
    t.string "postal_code"
    t.string "street_address", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["user_id"], name: "index_addresses_on_user_id"
  end

  create_table "cart_live_events", force: :cascade do |t|
    t.string "action", null: false
    t.integer "color_id"
    t.string "color_label"
    t.datetime "created_at", null: false
    t.string "ip_address"
    t.decimal "price", precision: 10, scale: 3
    t.integer "product_id"
    t.string "product_name"
    t.integer "quantity", default: 1, null: false
    t.string "session_id", null: false
    t.string "size_label"
    t.datetime "updated_at", null: false
    t.string "user_agent"
    t.integer "user_id"
    t.index ["action"], name: "index_cart_live_events_on_action"
    t.index ["created_at"], name: "index_cart_live_events_on_created_at"
    t.index ["product_id"], name: "index_cart_live_events_on_product_id"
    t.index ["session_id"], name: "index_cart_live_events_on_session_id"
    t.index ["user_id"], name: "index_cart_live_events_on_user_id"
  end

  create_table "categories", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name", null: false
    t.integer "parent_id"
    t.integer "position", default: 0
    t.string "slug", null: false
    t.datetime "updated_at", null: false
    t.index ["parent_id"], name: "index_categories_on_parent_id"
    t.index ["slug"], name: "index_categories_on_slug", unique: true
  end

  create_table "client_activity_events", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "event_type", null: false
    t.string "ip_address"
    t.json "metadata", default: {}
    t.string "path"
    t.integer "product_id"
    t.string "product_name"
    t.string "session_id", null: false
    t.datetime "updated_at", null: false
    t.string "user_agent"
    t.integer "user_id"
    t.index ["created_at"], name: "index_client_activity_events_on_created_at"
    t.index ["event_type", "created_at"], name: "index_client_activity_events_on_event_type_and_created_at"
    t.index ["product_id"], name: "index_client_activity_events_on_product_id"
    t.index ["session_id"], name: "index_client_activity_events_on_session_id"
    t.index ["user_id"], name: "index_client_activity_events_on_user_id"
  end

  create_table "contact_messages", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.text "message", null: false
    t.string "name", null: false
    t.string "phone"
    t.boolean "read", default: false, null: false
    t.datetime "updated_at", null: false
  end

  create_table "hero_sliders", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.string "link_url"
    t.integer "position", default: 0
    t.string "subtitle"
    t.string "title"
    t.datetime "updated_at", null: false
  end

  create_table "home_page_assets", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_home_page_assets_on_key", unique: true
  end

  create_table "order_items", force: :cascade do |t|
    t.string "color_label"
    t.datetime "created_at", null: false
    t.integer "order_id", null: false
    t.integer "product_id"
    t.string "product_name", null: false
    t.string "product_slug"
    t.integer "quantity", null: false
    t.string "size_label"
    t.decimal "unit_price", precision: 10, scale: 3, null: false
    t.datetime "updated_at", null: false
    t.index ["order_id"], name: "index_order_items_on_order_id"
    t.index ["product_id"], name: "index_order_items_on_product_id"
  end

  create_table "orders", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.decimal "discount_amount", precision: 10, scale: 3, default: "0.0", null: false
    t.string "guest_email"
    t.string "guest_name"
    t.string "guest_phone"
    t.boolean "loyalty_counted", default: false, null: false
    t.text "notes"
    t.string "order_number", null: false
    t.string "payment_method", default: "cash", null: false
    t.string "promo_code"
    t.string "shipping_address", null: false
    t.decimal "shipping_cost", precision: 10, scale: 3, default: "7.0", null: false
    t.string "shipping_delegation", null: false
    t.string "shipping_governorate", null: false
    t.string "shipping_postal_code"
    t.integer "status", default: 0, null: false
    t.boolean "stock_restored", default: false, null: false
    t.decimal "subtotal", precision: 10, scale: 3, null: false
    t.decimal "total", precision: 10, scale: 3, null: false
    t.datetime "updated_at", null: false
    t.integer "user_id"
    t.decimal "wallet_amount", precision: 10, scale: 3, default: "0.0", null: false
    t.index ["order_number"], name: "index_orders_on_order_number", unique: true
    t.index ["user_id"], name: "index_orders_on_user_id"
  end

  create_table "product_color_sizes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "position", default: 0, null: false
    t.integer "product_color_id", null: false
    t.string "size", null: false
    t.integer "stock", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["product_color_id", "size"], name: "index_product_color_sizes_on_product_color_id_and_size", unique: true
    t.index ["product_color_id"], name: "index_product_color_sizes_on_product_color_id"
  end

  create_table "product_colors", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "hex"
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.integer "product_id", null: false
    t.datetime "updated_at", null: false
    t.index ["product_id"], name: "index_product_colors_on_product_id"
  end

  create_table "product_reviews", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "ip_address"
    t.integer "product_id", null: false
    t.integer "stars", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id"
    t.index ["product_id", "ip_address"], name: "index_product_reviews_on_product_id_and_ip_address", unique: true, where: "user_id IS NULL"
    t.index ["product_id", "user_id"], name: "index_product_reviews_on_product_id_and_user_id", unique: true, where: "user_id IS NOT NULL"
    t.index ["product_id"], name: "index_product_reviews_on_product_id"
    t.index ["stars"], name: "index_product_reviews_on_stars"
    t.index ["user_id"], name: "index_product_reviews_on_user_id"
  end

  create_table "products", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.string "age_group"
    t.integer "category_id"
    t.datetime "created_at", null: false
    t.text "description"
    t.boolean "featured", default: false, null: false
    t.string "name", null: false
    t.boolean "on_promo", default: false, null: false
    t.decimal "price", precision: 10, scale: 3, null: false
    t.decimal "promo_price", precision: 10, scale: 3
    t.string "reference"
    t.string "slug", null: false
    t.integer "stock", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["category_id"], name: "index_products_on_category_id"
    t.index ["reference"], name: "index_products_on_reference", unique: true
    t.index ["slug"], name: "index_products_on_slug", unique: true
  end

  create_table "promo_codes", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.string "code", null: false
    t.datetime "created_at", null: false
    t.integer "discount_type", default: 0, null: false
    t.decimal "discount_value", precision: 10, scale: 3, null: false
    t.datetime "expires_at"
    t.decimal "max_discount", precision: 10, scale: 3
    t.decimal "min_order_amount", precision: 10, scale: 3
    t.boolean "once_per_customer", default: false, null: false
    t.boolean "show_on_products", default: false, null: false
    t.datetime "updated_at", null: false
    t.integer "usage_limit"
    t.integer "used_count", default: 0, null: false
    t.integer "user_id"
    t.index ["code"], name: "index_promo_codes_on_code", unique: true
    t.index ["user_id"], name: "index_promo_codes_on_user_id"
  end

  create_table "promo_popups", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.string "link_url"
    t.integer "position", default: 0, null: false
    t.string "title"
    t.datetime "updated_at", null: false
  end

  create_table "size_attributes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_size_attributes_on_name", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "encrypted_password"
    t.integer "fidelity_points", default: 0, null: false
    t.decimal "loyalty_spend_progress", precision: 10, scale: 3, default: "0.0", null: false
    t.string "name", null: false
    t.string "phone"
    t.string "provider"
    t.integer "role", default: 0, null: false
    t.string "uid"
    t.datetime "updated_at", null: false
    t.decimal "wallet_balance", precision: 10, scale: 3, default: "0.0", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["provider", "uid"], name: "index_users_on_provider_and_uid", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "activity_logs", "users"
  add_foreign_key "addresses", "users"
  add_foreign_key "cart_live_events", "products"
  add_foreign_key "cart_live_events", "users"
  add_foreign_key "categories", "categories", column: "parent_id"
  add_foreign_key "client_activity_events", "products"
  add_foreign_key "client_activity_events", "users"
  add_foreign_key "order_items", "orders"
  add_foreign_key "order_items", "products"
  add_foreign_key "orders", "users"
  add_foreign_key "product_color_sizes", "product_colors"
  add_foreign_key "product_colors", "products"
  add_foreign_key "product_reviews", "products"
  add_foreign_key "product_reviews", "users"
  add_foreign_key "products", "categories"
  add_foreign_key "promo_codes", "users"
end
