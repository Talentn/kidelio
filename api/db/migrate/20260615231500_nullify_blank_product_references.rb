class NullifyBlankProductReferences < ActiveRecord::Migration[8.0]
  def up
    execute <<~SQL.squish
      UPDATE products SET reference = NULL WHERE reference = ''
    SQL
  end

  def down
    # irreversible — empty strings were invalid for the unique index anyway
  end
end
