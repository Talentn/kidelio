class CreateProductReviews < ActiveRecord::Migration[8.1]
  def change
    create_table :product_reviews do |t|
      t.references :product, null: false, foreign_key: true
      t.references :user, foreign_key: true
      t.integer :stars, null: false
      t.string :ip_address

      t.timestamps
    end

    add_index :product_reviews, %i[product_id user_id], unique: true, where: "user_id IS NOT NULL"
    add_index :product_reviews, %i[product_id ip_address], unique: true, where: "user_id IS NULL"
    add_index :product_reviews, :stars
  end
end
