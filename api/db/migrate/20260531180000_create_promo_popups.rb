class CreatePromoPopups < ActiveRecord::Migration[8.1]
  def change
    create_table :promo_popups do |t|
      t.string :title
      t.string :link_url
      t.boolean :active, default: true, null: false
      t.integer :position, default: 0, null: false

      t.timestamps
    end
  end
end
