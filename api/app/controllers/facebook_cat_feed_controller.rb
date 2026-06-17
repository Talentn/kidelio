# Meta Commerce Manager product catalog feed (RSS 2.0 + Google product namespace).
# GET /facebook_cat_feed.xml
#
# Configure in: Business Manager → Catalogs → Data Sources → Scheduled Feed
# URL: https://kideliowear.com/facebook_cat_feed.xml
class FacebookCatFeedController < ApplicationController
  BRAND = "Kidelio"
  BASE_URL = "https://kideliowear.com"
  G_NS = "http://base.google.com/ns/1.0"

  def index
    products = Product.active
      .includes(:category, images_attachments: :blob,
                colors: { images_attachments: :blob, sizes: [] })
      .order(created_at: :desc)

    expires_in 30.minutes, public: true

    render xml: build_feed(products), content_type: "application/xml"
  end

  private

  def site_url
    ENV.fetch("SITE_URL", BASE_URL).chomp("/")
  end

  def build_feed(products)
    Nokogiri::XML::Builder.new(encoding: "UTF-8") do |xml|
      xml.rss("version" => "2.0", "xmlns:g" => G_NS) do
        xml.channel do
          xml.title "Kidelio — Catalogue produits"
          xml.link site_url
          xml.description "Flux catalogue Meta / Facebook pour Kidelio Wear"

          products.each do |product|
            item = catalog_item(product)
            next unless item

            xml.item do
              write_field(xml, :id, item[:id])
              write_field(xml, :title, item[:title])
              write_field(xml, :description, item[:description])
              write_field(xml, :link, item[:link])
              write_field(xml, :image_link, item[:image_link])
              write_field(xml, :availability, item[:availability])
              write_field(xml, :price, item[:price])
              write_field(xml, :sale_price, item[:sale_price])
              write_field(xml, :condition, item[:condition])
              write_field(xml, :brand, item[:brand])
              write_field(xml, :google_product_category, item[:google_product_category])
              write_field(xml, :product_type, item[:product_type])
              write_field(xml, :age_group, item[:age_group])
              write_field(xml, :quantity_to_sell_on_facebook, item[:quantity_to_sell_on_facebook])
              write_field(xml, :custom_label_0, item[:custom_label_0])
              write_field(xml, :custom_label_1, item[:custom_label_1])
              write_field(xml, :custom_label_2, item[:custom_label_2])
              write_field(xml, :custom_label_3, item[:custom_label_3])
              item[:additional_image_links]&.each do |url|
                write_field(xml, :additional_image_link, url)
              end
            end
          end
        end
      end
    end.to_xml
  end

  def write_field(xml, name, value)
    return if value.blank?

    xml["g"].send(name, value)
  end

  def catalog_item(product)
    image = primary_image_url(product)
    return nil unless image.present?

    in_stock   = product.in_stock?
    on_promo   = product.on_promo? && product.promo_price.present?
    extra_imgs = extra_image_urls(product).first(9)

    item = {
      id: product.id.to_s,
      title: product.name,
      description: product.description.presence || product.name,
      availability: in_stock ? "in stock" : "out of stock",
      condition: "new",
      price: format_price(product.price),
      link: "#{site_url}/produits/#{product.slug}",
      image_link: image,
      brand: BRAND,
      google_product_category: google_category(product),
      product_type: product.category&.name,
      age_group: meta_age_group(product),
      custom_label_0: product.category&.name,
      custom_label_1: product.age_group.presence,
      custom_label_2: on_promo ? "promo" : "regular",
      custom_label_3: in_stock ? "in_stock" : "out_of_stock",
      quantity_to_sell_on_facebook: product_total_stock(product),
      additional_image_links: extra_imgs
    }

    item[:sale_price] = format_price(product.promo_price) if on_promo
    item
  end

  def format_price(amount)
    "#{"%.3f" % amount} TND"
  end

  def primary_image_url(product)
    attachments = product.listing_image_attachments
    return nil if attachments.empty?

    json_variant_url(attachments.first, size: :large)
  rescue StandardError
    nil
  end

  def extra_image_urls(product)
    attachments = product.listing_image_attachments[1..]
    return [] if attachments.nil? || attachments.empty?

    attachments.filter_map do |att|
      json_variant_url(att, size: :large)
    rescue StandardError
      nil
    end
  end

  def product_total_stock(product)
    colors = product.colors
    if colors.any?
      colors.sum do |c|
        if c.sizes.any?
          c.sizes.sum(&:stock)
        else
          0
        end
      end.then { |s| s.positive? ? s : product.stock }
    else
      product.stock
    end
  end

  def google_category(product)
    case product.category&.name&.downcase
    when /bébé|bebe|nourrisson/   then "166"
    when /enfant|fille|garçon/    then "1604"
    when /jouet|jeux|toy/         then "1249"
    when /chaussure|shoes/        then "187"
    when /accessoire/             then "169"
    else "5605"
    end
  end

  # Meta accepts: newborn, infant, toddler, kids, adult
  def meta_age_group(product)
    age = product.age_group.to_s.downcase
    return "newborn" if age.match?(/nouveau|newborn|0.?6|naissance/)
    return "infant" if age.match?(/bébé|bebe|nourrisson|infant/)
    return "toddler" if age.match?(/toddler|1.?3|2.?4/)
    return "kids" if age.match?(/enfant|fille|garçon|kid|3.?12|4.?12|6.?12/)

    "kids"
  end
end
