class AddIntigoDeliveryAttemptsToOrders < ActiveRecord::Migration[8.1]
  def change
    # Number of delivery/call attempts reported by Intigo on the parcel.
    add_column :orders, :intigo_delivery_attempts, :integer
  end
end
