class AddDeviseToUsers < ActiveRecord::Migration[8.1]
  def change
    rename_column :users, :password_digest, :encrypted_password
    change_column_null :users, :encrypted_password, true

    add_column :users, :provider, :string
    add_column :users, :uid, :string
    add_index :users, %i[provider uid], unique: true
  end
end
