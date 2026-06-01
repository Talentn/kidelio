class ActivityLogger
  SKIP_ATTRS = %w[
    id created_at updated_at encrypted_password password password_confirmation
    reset_password_token remember_created_at sign_in_count current_sign_in_at
    last_sign_in_at current_sign_in_ip last_sign_in_ip provider uid
  ].freeze

  def self.log(action:, entity:, changes: {}, user: Current.user, normalize: true)
    ActivityLog.create!(
      user: user,
      action: action,
      entity_type: entity.class.audit_entity_type,
      entity_id: entity.id&.to_s,
      entity_name: entity_name_for(entity),
      diff: normalize ? normalize_changes(entity, changes) : changes.stringify_keys,
      ip_address: Current.request&.remote_ip,
      user_agent: Current.request&.user_agent&.truncate(500)
    )
  end

  def self.log_create(entity, user: Current.user)
    snapshot = build_create_snapshot(entity)
    log(action: "CREATE", entity: entity, changes: snapshot, user: user)
  end

  def self.log_update(entity, changes, user: Current.user)
    return if changes.blank?

    keys = changes.stringify_keys.keys
    if entity.is_a?(Order) && keys == [ "status" ]
      pair = changes["status"] || changes[:status]
      log_status(entity, from: pair[0], to: pair[1], user: user)
    else
      log(action: "UPDATE", entity: entity, changes: changes, user: user)
    end
  end

  def self.log_destroy(entity, user: Current.user)
    log(action: "DELETE", entity: entity, user: user)
  end

  def self.log_status(entity, from:, to:, user: Current.user)
    log(
      action: "STATUS_CHANGE",
      entity: entity,
      changes: { "status" => [ humanize_order_status(from), humanize_order_status(to) ] },
      normalize: false,
      user: user
    )
  end

  def self.log_media(entity, attachment: :images, detail: nil, user: Current.user)
    return unless user&.staff? || Current.user&.staff?

    label = detail.presence || media_label(entity, attachment)
    log(
      action: "UPDATE",
      entity: entity,
      changes: { attachment.to_s => [ nil, label ] },
      user: user
    )
  end

  def self.log_auth(action, user)
    ActivityLog.create!(
      user: user,
      action: action,
      entity_type: "User",
      entity_id: user.id.to_s,
      entity_name: user.email,
      ip_address: Current.request&.remote_ip,
      user_agent: Current.request&.user_agent&.truncate(500)
    )
  end

  def self.entity_name_for(entity)
    return entity.audit_label if entity.respond_to?(:audit_label)

    entity.try(:order_number) ||
      entity.try(:code) ||
      entity.try(:name) ||
      entity.try(:email) ||
      entity.id.to_s
  end

  def self.normalize_changes(entity, changes)
    changes.stringify_keys.each_with_object({}) do |(key, pair), out|
      out[key] = if pair.is_a?(Array) && pair.length == 2
        [ humanize_value(entity, pair[0], key: key), humanize_value(entity, pair[1], key: key) ]
      else
        humanize_value(entity, pair, key: key)
      end
    end
  end

  def self.build_create_snapshot(entity)
    entity.attributes.except(*SKIP_ATTRS).each_with_object({}) do |(key, value), out|
      next if value.nil? || value == ""

      out[key] = [ nil, humanize_value(entity, value, key: key) ]
    end
  end

  def self.humanize_value(entity, value, key: nil)
    return format_scalar(value) if key.nil?

    case key.to_s
    when "status"
      humanize_order_status(value)
    when "role"
      humanize_user_role(value)
    when "discount_type"
      value.to_s == "percentage" || value == 0 ? "Pourcentage" : "Montant fixe"
    when "active", "featured", "on_promo", "read"
      value_in_bool(value) ? "Oui" : "Non"
    when "category_id"
      humanize_category_id(value)
    when "product_id", "product_color_id"
      humanize_foreign_id(value, key)
    else
      format_scalar(value)
    end
  end

  def self.humanize_order_status(value)
    key = resolve_enum_key(Order, :status, value)
    OrderTrackingJson::STATUS_LABELS[key] || key.to_s.humanize
  end

  def self.humanize_user_role(value)
    key = resolve_enum_key(User, :role, value)
    { "client" => "Client", "employee" => "Employé", "admin" => "Administrateur" }[key] || key.to_s
  end

  def self.humanize_category_id(value)
    return "—" if value.blank?

    Category.find_by(id: value)&.name || "Catégorie ##{value}"
  end

  def self.humanize_foreign_id(value, field)
    return "—" if value.blank?

    case field.to_s
    when "product_id"
      Product.find_by(id: value)&.name || "Produit ##{value}"
    when "product_color_id"
      pc = ProductColor.find_by(id: value)
      pc ? entity_name_for(pc) : "Couleur ##{value}"
    else
      value.to_s
    end
  end

  def self.resolve_enum_key(model, enum_name, value)
    str = value.is_a?(Symbol) ? value.to_s : value.to_s
    return str if model.defined_enums[enum_name.to_s]&.key?(str)

    mapping = model.defined_enums[enum_name.to_s]
    return str unless mapping

    mapping.key(value) || mapping.key(str) || str
  end

  def self.format_scalar(value)
    return "—" if value.nil?
    return "Oui" if value == true
    return "Non" if value == false

    value.to_s
  end

  def self.value_in_bool(value)
    value == true || value == "true" || value == 1 || value == "1"
  end

  def self.media_label(entity, attachment)
    count = entity.public_send(attachment).attachments.size
    name = attachment == :image ? "image" : "images"
    count.positive? ? "#{count} #{name}(s)" : "#{name} modifiée(s)"
  end

  private_class_method :entity_name_for, :normalize_changes, :build_create_snapshot,
                       :humanize_value, :humanize_order_status, :humanize_user_role,
                       :humanize_category_id, :humanize_foreign_id, :resolve_enum_key,
                       :format_scalar, :value_in_bool, :media_label
end
