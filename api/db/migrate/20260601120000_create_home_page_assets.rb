class CreateHomePageAssets < ActiveRecord::Migration[8.1]
  def change
    create_table :home_page_assets do |t|
      t.string :key, null: false
      t.timestamps
    end
    add_index :home_page_assets, :key, unique: true
  end
end
