class AddStockRestoredToOrders < ActiveRecord::Migration[8.0]
  def change
    add_column :orders, :stock_restored, :boolean, default: false, null: false
  end
end
