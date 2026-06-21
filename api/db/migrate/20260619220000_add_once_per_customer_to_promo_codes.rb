class AddOncePerCustomerToPromoCodes < ActiveRecord::Migration[8.0]
  def change
    add_column :promo_codes, :once_per_customer, :boolean, default: false, null: false
  end
end
