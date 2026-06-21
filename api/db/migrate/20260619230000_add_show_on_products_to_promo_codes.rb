class AddShowOnProductsToPromoCodes < ActiveRecord::Migration[8.0]
  def change
    add_column :promo_codes, :show_on_products, :boolean, default: false, null: false
  end
end
