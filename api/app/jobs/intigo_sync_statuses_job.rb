# Recurring job (config/recurring.yml) — keeps order statuses in sync with Intigo.
class IntigoSyncStatusesJob < ApplicationJob
  queue_as :default

  def perform
    result = IntigoStatusSync.new.sync_all!
    Rails.logger.info("[IntigoSyncStatusesJob] synced=#{result[:synced]}")
  rescue IntigoStatusSync::Error => e
    Rails.logger.warn("[IntigoSyncStatusesJob] #{e.message}")
  end
end
