# Business side effects of an order status change (loyalty, wallet refund,
# stock restore, promo reversal). Shared by the admin API and the Intigo
# status sync so both paths behave identically.
class OrderStatusSideEffects
  CANCELLED_STATUSES = %w[cancelled refunded].freeze

  def self.apply!(order, previous_status)
    new(order, previous_status).apply!
  end

  def initialize(order, previous_status)
    @order = order
    @previous_status = previous_status
  end

  def apply!
    return if @previous_status == @order.status

    handle_loyalty!
    handle_cancel!
  end

  private

  def handle_loyalty!
    if CANCELLED_STATUSES.include?(@order.status) && CANCELLED_STATUSES.exclude?(@previous_status)
      refund_wallet! if @order.wallet_amount.to_d.positive?
    end

    if @order.status == LoyaltyProgram::COUNTED_STATUS && @previous_status != LoyaltyProgram::COUNTED_STATUS
      LoyaltyProgram.record_order!(@order)
    elsif @previous_status == LoyaltyProgram::COUNTED_STATUS && @order.status != LoyaltyProgram::COUNTED_STATUS
      LoyaltyProgram.reverse_order!(@order)
    end
  end

  def handle_cancel!
    return unless CANCELLED_STATUSES.include?(@order.status)
    return if CANCELLED_STATUSES.include?(@previous_status)

    OrderStockRestorer.restore!(@order)
    reverse_promo!
  end

  def refund_wallet!
    return unless @order.user

    @order.user.increment!(:wallet_balance, @order.wallet_amount.to_d)
  end

  def reverse_promo!
    return if @order.promo_code.blank?

    promo = PromoCode.find_by(code: @order.promo_code)
    return unless promo && promo.used_count.positive?

    promo.decrement!(:used_count)
  end
end
