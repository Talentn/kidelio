module CartAccess
  extend ActiveSupport::Concern

  def cart
    @cart ||= CartManager.new(session)
  end
  helper_method :cart if respond_to?(:helper_method)
end
