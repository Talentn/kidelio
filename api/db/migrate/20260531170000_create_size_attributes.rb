class CreateSizeAttributes < ActiveRecord::Migration[8.1]
  def change
    create_table :size_attributes do |t|
      t.string  :name,     null: false
      t.integer :position, null: false, default: 0
      t.timestamps
    end

    add_index :size_attributes, :name, unique: true
  end
end
