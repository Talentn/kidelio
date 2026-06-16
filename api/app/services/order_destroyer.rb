class OrderDestroyer
  class Error < StandardError; end

  CANCELLED_STATUSES = %w[cancelled refunded].freeze

  def initialize(order)
    @order = order
  end

  def call
    Order.transaction do
      reverse_side_effects!
      @order.destroy!
    end
  end

  private

  def reverse_side_effects!
    reverse_loyalty!
    reverse_wallet!
    reverse_promo!
    OrderStockRestorer.restore!(@order)
  end

  def reverse_loyalty!
    return unless @order.loyalty_counted?

    LoyaltyProgram.reverse_order!(@order)
  end

  def reverse_wallet!
    return unless @order.user
    return unless @order.wallet_amount.to_d.positive?
    return if CANCELLED_STATUSES.include?(@order.status)

    @order.user.increment!(:wallet_balance, @order.wallet_amount.to_d)
  end

  def reverse_promo!
    return if @order.promo_code.blank?

    promo = PromoCode.find_by(code: @order.promo_code)
    return unless promo && promo.used_count.positive?

    promo.decrement!(:used_count)
  end
end
