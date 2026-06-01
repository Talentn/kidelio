class CreateProductColors < ActiveRecord::Migration[8.1]
  def change
    create_table :product_colors do |t|
      t.references :product, null: false, foreign_key: true
      t.string :name, null: false
      t.string :hex
      t.integer :position, default: 0, null: false
      t.timestamps
    end
  end
end
