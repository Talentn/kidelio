class CreateProductColorSizes < ActiveRecord::Migration[8.1]
  def change
    create_table :product_color_sizes do |t|
      t.references :product_color, null: false, foreign_key: true
      t.string  :size,     null: false
      t.integer :stock,    null: false, default: 0
      t.integer :position, null: false, default: 0
      t.timestamps
    end

    add_index :product_color_sizes, %i[product_color_id size], unique: true
  end
end
