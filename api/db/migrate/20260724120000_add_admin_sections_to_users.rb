class AddAdminSectionsToUsers < ActiveRecord::Migration[8.1]
  def change
    # NULL = access to all admin sections (default). An array of section keys
    # restricts the back-office navigation for that staff account.
    add_column :users, :admin_sections, :json
  end
end
