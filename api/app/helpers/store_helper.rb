module StoreHelper
  def product_image(product, css_class: "product-img")
    if product.images.attached?
      image_tag product.images.first, class: css_class, alt: product.name
    else
      content_tag :div, "🧸", class: "#{css_class} placeholder"
    end
  end

  def format_tnd(amount)
    number_to_currency(amount, unit: " TND", format: "%n%u", precision: 3)
  end

  GOVERNORATES = %w[
    Tunis Ariana Ben\ Arous Manouba Nabeul Zaghouan Bizerte Béja Jendouba Kef Siliana
    Sousse Monastir Mahdia Sfax Kairouan Kasserine Sidi\ Bouzid Gabès Medenine Tataouine
    Gafsa Tozeur Kebili
  ].freeze
end
