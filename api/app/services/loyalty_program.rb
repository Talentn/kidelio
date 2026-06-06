# Loyalty: spend 300 TND (subtotal, excl. delivery) on delivered orders → claim 10 000 pts (= 10 TND)
# Reward: 10% off coupon OR 10 TND store credit
module LoyaltyProgram
  SPEND_THRESHOLD = 300.to_d
  REWARD_POINTS = 10_000
  REWARD_WALLET_TND = 10.to_d
  COUPON_PERCENT = 10.to_d
  COUNTED_STATUS = "delivered"

  module_function

  def snapshot(user)
    progress = user.loyalty_spend_progress.to_d
    {
      spend_threshold: SPEND_THRESHOLD,
      spend_progress: progress,
      spend_remaining: [SPEND_THRESHOLD - progress, 0].max,
      progress_percent: [(progress / SPEND_THRESHOLD * 100).round(1), 100].min,
      can_claim: progress >= SPEND_THRESHOLD,
      reward_points: REWARD_POINTS,
      reward_value_tnd: REWARD_WALLET_TND,
      wallet_balance: user.wallet_balance.to_d,
      fidelity_points: user.fidelity_points
    }
  end

  def record_order!(order)
    user = order.user
    return unless user
    return unless order.status == COUNTED_STATUS
    return if order.loyalty_counted?

    user.with_lock do
      user.increment!(:loyalty_spend_progress, order.subtotal.to_d)
      order.update!(loyalty_counted: true)
    end
  end

  def reverse_order!(order)
    user = order.user
    return unless user
    return unless order.loyalty_counted?

    user.with_lock do
      new_progress = [user.loyalty_spend_progress.to_d - order.subtotal.to_d, 0].max
      user.update!(loyalty_spend_progress: new_progress)
      order.update!(loyalty_counted: false)
    end
  end

  def claim!(user, reward_type)
    raise ArgumentError, "Récompense invalide" unless %w[coupon wallet].include?(reward_type.to_s)

    user.with_lock do
      raise ArgumentError, "Pas assez d'achats pour réclamer" if user.loyalty_spend_progress.to_d < SPEND_THRESHOLD

      user.decrement!(:loyalty_spend_progress, SPEND_THRESHOLD)

      case reward_type.to_s
      when "coupon"
        code = generate_coupon!(user)
        { type: "coupon", code: code, discount_percent: COUPON_PERCENT }
      when "wallet"
        user.increment!(:wallet_balance, REWARD_WALLET_TND)
        user.increment!(:fidelity_points, REWARD_POINTS)
        { type: "wallet", amount: REWARD_WALLET_TND, wallet_balance: user.wallet_balance.to_d }
      end
    end
  end

  def generate_coupon!(user)
    code = loop do
      candidate = "FIDELITE-#{SecureRandom.alphanumeric(8).upcase}"
      break candidate unless PromoCode.exists?(code: candidate)
    end

    PromoCode.create!(
      code: code,
      discount_type: :percentage,
      discount_value: COUPON_PERCENT,
      usage_limit: 1,
      active: true,
      expires_at: 90.days.from_now,
      user: user
    )
    user.increment!(:fidelity_points, REWARD_POINTS)
    code
  end
end
