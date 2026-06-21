class PromoCodeCustomerUsage
  COUNTABLE_STATUSES = Order.statuses.values_at(
    :pending, :confirmed, :processing, :shipped, :out_for_delivery, :delivered
  ).freeze

  class << self
    def already_used?(promo_code:, user: nil, **customer)
      scope = Order.where(promo_code: promo_code, status: COUNTABLE_STATUSES)
      return false if scope.none?

      if user.present? && scope.where(user_id: user.id).exists?
        return true
      end

      norm_phone = normalize_phone(customer[:guest_phone])
      norm_name = normalize_text(customer[:guest_name])
      norm_addr = normalize_address(
        customer[:shipping_governorate],
        customer[:shipping_delegation],
        customer[:shipping_address]
      )

      return false if norm_phone.blank? && norm_name.blank? && norm_addr.blank?

      scope.find_each do |order|
        return true if norm_phone.present? && normalize_phone(order.guest_phone) == norm_phone
        return true if norm_name.present? && name_matches?(norm_name, order.guest_name)
        return true if norm_addr.present? && address_fingerprint(order) == norm_addr
      end

      false
    end

    def normalize_phone(phone)
      digits = phone.to_s.gsub(/\D/, "")
      return nil if digits.length < 8

      digits[-8..]
    end

    def normalize_text(text)
      normalized = text.to_s.strip.downcase.gsub(/\s+/, " ")
      normalized.presence
    end

    def normalize_address(governorate, delegation, street)
      parts = [governorate, delegation, street].map { |p| normalize_text(p) }.compact
      parts.join("|").presence
    end

    private

    def name_matches?(normalized_input, order_name)
      normalized_order = normalize_text(order_name)
      return false if normalized_input.blank? || normalized_order.blank?
      return false if normalized_input.length < 3

      normalized_input == normalized_order
    end

    def address_fingerprint(order)
      normalize_address(
        order.shipping_governorate,
        order.shipping_delegation,
        order.shipping_address
      )
    end
  end
end
