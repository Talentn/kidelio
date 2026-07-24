class AddIntigoRegionIdsToOrders < ActiveRecord::Migration[8.0]
  def change
    add_column :orders, :intigo_city_id, :integer
    add_column :orders, :intigo_district_id, :integer
  end
end
