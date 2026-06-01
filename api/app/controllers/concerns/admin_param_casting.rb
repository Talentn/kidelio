module AdminParamCasting
  extend ActiveSupport::Concern

  private

  def cast_booleans(hash, *keys)
    keys.each do |key|
      hash[key] = ActiveModel::Type::Boolean.new.cast(hash[key]) if hash.key?(key)
    end
    hash
  end
end
