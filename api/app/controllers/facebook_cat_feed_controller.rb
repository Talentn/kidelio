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
                colors: { images_attachments: :blob })
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
            catalog_items_for(product).each do |item|
              xml.item do
                write_field(xml, :id, item[:id])
                write_field(xml, :item_group_id, item[:item_group_id])
                write_field(xml, :title, item[:title])
                write_field(xml, :description, item[:description])
                write_field(xml, :link, item[:link])
                write_field(xml, :image_link, item[:image_link])
                write_field(xml, :availability, item[:availability])
                write_field(xml, :price, item[:price])
                write_field(xml, :sale_price, item[:sale_price])
                write_field(xml, :condition, item[:condition])
                write_field(xml, :brand, item[:brand])
                write_field(xml, :color, item[:color])
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
      end
    end.to_xml
  end

  def write_field(xml, name, value)
    return if value.blank?

    xml["g"].send(name, value)
  end

  def catalog_items_for(product)
    if product.colors.any?
      product.colors.flat_map { |color| catalog_items_for_color(product, color) }
    else
      item = catalog_item_simple(product)
      item ? [item] : []
    end
  end

  def catalog_items_for_color(product, color)
    [catalog_variant_item(product, color)].compact
  end

  def catalog_variant_item(product, color)
    image = variant_image_url(product, color)
    return nil unless image.present?

    stock    = variant_stock(color, product)
    in_stock = stock.positive?
    on_promo = product.on_promo? && product.promo_price.present?
    title    = variant_title(product.name, color.name)

    item = shared_item_fields(product, on_promo:, in_stock:, stock:).merge(
      id: variant_catalog_id(product, color),
      item_group_id: product.id.to_s,
      title: title,
      image_link: image,
      color: color.name,
      additional_image_links: color_extra_image_urls(color).first(9)
    )

    item[:sale_price] = format_price(product.promo_price) if on_promo
    item
  end

  def catalog_item_simple(product)
    image = primary_image_url(product)
    return nil unless image.present?

    in_stock = product.in_stock?
    on_promo = product.on_promo? && product.promo_price.present?

    item = shared_item_fields(
      product,
      on_promo:,
      in_stock:,
      stock: product.stock
    ).merge(
      id: product.id.to_s,
      title: product.name,
      image_link: image,
      additional_image_links: extra_image_urls(product).first(9)
    )

    item[:sale_price] = format_price(product.promo_price) if on_promo
    item
  end

  def shared_item_fields(product, on_promo:, in_stock:, stock:)
    {
      description: product.description.presence || product.name,
      availability: in_stock ? "in stock" : "out of stock",
      condition: "new",
      price: format_price(product.price),
      link: "#{site_url}/produits/#{product.slug}",
      brand: BRAND,
      google_product_category: google_category(product),
      product_type: product.category&.name,
      age_group: meta_age_group(product),
      custom_label_0: product.category&.name,
      custom_label_1: product.age_group.presence,
      custom_label_2: on_promo ? "promo" : "regular",
      custom_label_3: in_stock ? "in_stock" : "out_of_stock",
      quantity_to_sell_on_facebook: stock
    }
  end

  def variant_catalog_id(product, color = nil)
    parts = [product.id.to_s]
    return parts.join("-") unless color

    parts << "c#{color.id}"
    parts.join("-")
  end

  def variant_title(product_name, color_name)
    [product_name, color_name].join(" — ")
  end

  def variant_stock(color, product)
    color.total_stock || product.stock
  end

  def variant_image_url(product, color)
    if color.images.attached?
      feed_image_url(color.images.first)
    else
      primary_image_url(product)
    end
  rescue StandardError
    nil
  end

  def format_price(amount)
    "#{"%.3f" % amount} TND"
  end

  def primary_image_url(product)
    attachments = product.listing_image_attachments
    return nil if attachments.empty?

    feed_image_url(attachments.first)
  rescue StandardError
    nil
  end

  def extra_image_urls(product)
    attachments = product.listing_image_attachments[1..]
    return [] if attachments.nil? || attachments.empty?

    attachments.filter_map { |att| feed_image_url(att) }
  end

  def color_extra_image_urls(color)
    return [] unless color.images.attached?

    color.images.to_a[1..].filter_map { |att| feed_image_url(att) }
  end

  # Meta only accepts JPEG/PNG (not WebP) and fetches images directly, so we emit
  # *proxy* URLs (HTTP 200 with the actual JPEG bytes) rather than the default
  # redirect URLs that bounce to a short-lived signed disk URL. Returns nil on
  # failure so we never serve an invalid (e.g. WebP original) image to the feed.
  def feed_image_url(attachment)
    return nil if attachment.nil?
    return nil if attachment.respond_to?(:attached?) && !attachment.attached?

    content_type = attachment.respond_to?(:content_type) ? attachment.content_type.to_s : ""
    return nil unless content_type.start_with?("image/")

    dims = VARIANT_SIZES.fetch(:large)
    variant = attachment.variant(resize_to_limit: dims, format: :jpg, saver: { quality: 85 })
    rails_storage_proxy_url(variant, **blob_url_options)
  rescue StandardError
    nil
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
    return "adult" if age.match?(/adulte|adult|femme|homme|women|men/)
    return "kids" if age.match?(/enfant|fille|garçon|kid|3.?12|4.?12|6.?12/)

    "kids"
  end
end
