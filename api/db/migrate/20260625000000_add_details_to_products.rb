class AddDetailsToProducts < ActiveRecord::Migration[8.0]
  def change
    add_column :products, :details, :json
  end
end
