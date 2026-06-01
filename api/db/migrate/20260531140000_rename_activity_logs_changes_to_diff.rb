class RenameActivityLogsChangesToDiff < ActiveRecord::Migration[8.1]
  def change
    rename_column :activity_logs, :changes, :diff
  end
end
