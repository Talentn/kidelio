class AddIntigoFieldsToOrders < ActiveRecord::Migration[8.0]
  def change
    add_column :orders, :intigo_nid, :string
    add_column :orders, :intigo_sent_at, :datetime
    add_column :orders, :intigo_last_error, :text
    add_index :orders, :intigo_nid
  end
end
