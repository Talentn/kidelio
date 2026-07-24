class AddIntigoParcelOptionsToOrders < ActiveRecord::Migration[8.1]
  def change
    # Intigo parcel options, editable from the back-office and pushed to the
    # parcel while it is still in pickup (status 1000).
    add_column :orders, :intigo_can_open, :boolean, default: true, null: false
    add_column :orders, :intigo_is_exchange, :boolean, default: false, null: false
  end
end
