module Auditable
  extend ActiveSupport::Concern

  class_methods do
    def audit_as(entity_type)
      @audit_entity_type = entity_type
    end

    def audit_entity_type
      @audit_entity_type || name
    end
  end

  included do
    after_save :stash_audit_context, if: :auditing_enabled?
    after_commit :log_audit_create, on: :create, if: :auditing_enabled?
    after_commit :log_audit_update, on: :update, if: :auditing_enabled?
    after_commit :log_audit_destroy, on: :destroy, if: :auditing_enabled?
  end

  private

  def auditing_enabled?
    Current.user&.staff?
  end

  # Capture changes while saved_changes is still available; write log after commit.
  def stash_audit_context
    @audit_user_id = Current.user&.id
    return if previously_new_record?

    pending = saved_changes.except("updated_at", "id").stringify_keys
    @audit_pending_changes = pending if pending.present?
  end

  def audit_actor
    if @audit_user_id
      User.find_by(id: @audit_user_id)
    else
      Current.user
    end
  end

  def log_audit_create
    ActivityLogger.log_create(self, user: audit_actor)
    clear_audit_context
  end

  def log_audit_update
    changes = @audit_pending_changes
    user = audit_actor
    clear_audit_context
    return if changes.blank?

    if is_a?(Order) && changes.key?("status")
      pair = changes["status"]
      if pair.is_a?(Array) && pair.length == 2
        ActivityLogger.log_status(self, from: pair[0], to: pair[1], user: user)
      end
      changes = changes.except("status")
    end

    ActivityLogger.log_update(self, changes, user: user) if changes.present?
  end

  def log_audit_destroy
    user = audit_actor
    clear_audit_context
    ActivityLogger.log_destroy(self, user: user)
  end

  def clear_audit_context
    @audit_pending_changes = nil
    @audit_user_id = nil
  end
end
