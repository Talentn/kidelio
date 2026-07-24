class AddIntigoStatusToOrders < ActiveRecord::Migration[8.1]
  def change
    add_column :orders, :intigo_status, :integer
    add_column :orders, :intigo_status_label, :string
    add_column :orders, :intigo_synced_at, :datetime
  end
end
