class AddLoyaltyAndWallet < ActiveRecord::Migration[8.0]
  def change
    change_table :users, bulk: true do |t|
      t.decimal :wallet_balance, precision: 10, scale: 3, null: false, default: 0
      t.decimal :loyalty_spend_progress, precision: 10, scale: 3, null: false, default: 0
    end

    change_table :orders, bulk: true do |t|
      t.decimal :wallet_amount, precision: 10, scale: 3, null: false, default: 0
      t.boolean :loyalty_counted, null: false, default: false
    end

    add_reference :promo_codes, :user, foreign_key: true, null: true
  end
end
