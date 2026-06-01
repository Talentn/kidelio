module Api
  module V1
    # Public product catalog feed for Meta Dynamic Ads.
    # GET /api/v1/catalog.json
    #
    # Meta Commerce Manager reads this URL automatically to sync your catalog.
    # Set the feed URL in: Business Manager → Catalogs → Data Sources → Scheduled Feed
    # Use format: JSON, URL: https://yourdomain.com/api/v1/catalog.json
    class CatalogController < BaseController
      BRAND = "Kidelio"
      SITE_URL = -> { ENV.fetch("SITE_URL", "http://localhost:3000") }

      def index
        products = Product.active
          .includes(:category, images_attachments: :blob,
                    colors: { images_attachments: :blob })
          .order(created_at: :desc)

        expires_in 30.minutes, public: true

        render json: {
          data: products.filter_map { |p| catalog_item(p) }
        }
      end

      private

      def catalog_item(product)
        image = primary_image_url(product)
        return nil unless image.present?   # Meta requires an image

        in_stock   = product.in_stock?
        on_promo   = product.on_promo? && product.promo_price.present?
        extra_imgs = extra_image_urls(product).first(9)

        item = {
          id:           product.id.to_s,
          title:        product.name,
          description:  product.description.presence || product.name,
          availability: in_stock ? "in stock" : "out of stock",
          condition:    "new",

          # original / regular price
          price:        format_price(product.price),

          link:         "#{SITE_URL.call}/produits/#{product.slug}",
          image_link:   image,
          brand:        BRAND,

          google_product_category: google_category(product),

          # custom segmentation labels (visible in Meta catalog)
          custom_label_0: product.category&.name,
          custom_label_1: product.age_group.presence,
          custom_label_2: on_promo ? "promo" : "regular",
          custom_label_3: in_stock  ? "in_stock" : "out_of_stock",
        }

        # Sale price — only add if actually on promo
        item[:sale_price] = format_price(product.promo_price) if on_promo

        # Additional images
        item[:additional_image_link] = extra_imgs.join(",") if extra_imgs.any?

        # Inventory count from variants or direct stock
        total_stock = product_total_stock(product)
        item[:quantity_to_sell_on_facebook] = total_stock

        item.compact
      end

      def format_price(amount)
        # Meta expects "10.990 TND" format
        "#{"%.3f" % amount} TND"
      end

      def primary_image_url(product)
        attachments = product.listing_image_attachments
        return nil if attachments.empty?

        attachment = attachments.first
        return nil unless attachment.blob

        Rails.application.routes.url_helpers.rails_blob_url(
          attachment.blob,
          host: ENV.fetch("API_URL", "http://localhost:3001")
        )
      rescue StandardError
        nil
      end

      # Total sellable units across all variants (colors × sizes) or direct stock.
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

      def extra_image_urls(product)
        attachments = product.listing_image_attachments[1..]
        return [] if attachments.nil? || attachments.empty?

        attachments.filter_map do |att|
          next unless att.blob
          Rails.application.routes.url_helpers.rails_blob_url(
            att.blob,
            host: ENV.fetch("API_URL", "http://localhost:3001")
          )
        rescue StandardError
          nil
        end
      end

      # Maps internal categories to Google product taxonomy codes.
      # https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
      def google_category(product)
        case product.category&.name&.downcase
        when /bébé|bebe|nourrisson/   then "166"   # Apparel & Accessories > Clothing > Baby & Toddler Clothing
        when /enfant|fille|garçon/    then "1604"  # Apparel & Accessories > Clothing > Children's Clothing
        when /jouet|jeux|toy/         then "1249"  # Toys & Games
        when /chaussure|shoes/        then "187"   # Apparel & Accessories > Shoes
        when /accessoire/             then "169"   # Apparel & Accessories
        else                               "5605"  # Apparel & Accessories > Clothing
        end
      end
    end
  end
end
