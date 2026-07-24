# Intigo expects a local Tunisian number of 8+ digits (no +216 / leading 0).
module IntigoPhone
  class Error < StandardError; end

  module_function

  def normalize!(phone)
    digits = phone.to_s.gsub(/\D/, "")
    digits = digits.sub(/\A216/, "") if digits.start_with?("216") && digits.length > 8
    digits = digits.sub(/\A0/, "") if digits.start_with?("0") && digits.length > 8
    raise Error, "Téléphone invalide" if digits.length < 8

    digits
  end
end
