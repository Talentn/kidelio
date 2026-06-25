module Api
  module Admin
    class ProductsController < BaseController
      def index
        products = Product
          .includes(:category, images_attachments: :blob,
                    colors: [:sizes, { images_attachments: :blob }])
          .order(created_at: :desc)
        render json: { products: products.map { |p| admin_product_json(p) } }
      end

      def show
        product = Product.find(params[:id])
        render json: { product: admin_product_json(product, detail: true) }
      end

      def create
        product = Product.new(product_params)
        if product.save
          attach_images(product)
          invalidate_catalog_cache
          render json: { product: admin_product_json(product) }, status: :created
        else
          render json: { errors: product.errors.full_messages }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotUnique => e
        render json: { errors: [ uniqueness_error_message(e) ] }, status: :unprocessable_entity
      end

      def update
        product = Product.find(params[:id])
        if product.update(product_params)
          attach_images(product)
          invalidate_catalog_cache
          render json: { product: admin_product_json(product) }
        else
          render json: { errors: product.errors.full_messages }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotUnique => e
        render json: { errors: [ uniqueness_error_message(e) ] }, status: :unprocessable_entity
      end

      def destroy
        product = Product.find(params[:id])
        if product.destroy
          invalidate_catalog_cache
          render json: { ok: true }
        else
          render json: {
            errors: product.errors.full_messages.presence || [ "Impossible de supprimer ce produit" ]
          }, status: :unprocessable_entity
        end
      rescue ActiveRecord::DeleteRestrictionError
        render json: {
          errors: [ "Ce produit ne peut pas être supprimé car il est encore référencé ailleurs." ]
        }, status: :unprocessable_entity
      end

      private

      def listing_image_urls(product)
        product.listing_image_attachments.filter_map { |img| json_image_url(img) }
      end

      def product_params
        raw = params.permit(
          :name, :slug, :reference, :description, :price, :promo_price,
          :stock, :active, :featured, :on_promo, :category_id, :age_group
        )
        raw = cast_booleans(raw, :active, :featured, :on_promo)
        raw[:details] = parse_details(params[:details]) if params.key?(:details)
        raw
      end

      # The admin form sends `details` as a JSON string of [{label, value}] rows.
      def parse_details(raw)
        data = raw.is_a?(String) ? (JSON.parse(raw) rescue []) : raw
        Array(data).filter_map do |row|
          row = row.respond_to?(:to_h) ? row.to_h : {}
          label = row["label"].to_s.strip
          value = row["value"].to_s.strip
          next if label.blank? && value.blank?

          { "label" => label, "value" => value }
        end
      end

      def attach_images(product)
        return unless params[:images].present?

        Array(params[:images]).each do |file|
          ImageOptimizer.attach_optimized(product, :images, file)
        end
        ActivityLogger.log_media(product, attachment: :images, detail: "Images produit ajoutées")
      end

      def uniqueness_error_message(error)
        msg = error.message.to_s
        return "Cette référence est déjà utilisée" if msg.include?("reference")
        return "Ce slug est déjà utilisé" if msg.include?("slug")

        "Cette valeur existe déjà"
      end

      def admin_product_json(product, detail: false)
        json = {
          id: product.id,
          name: product.name,
          slug: product.slug,
          reference: product.reference,
          price: product.price,
          promo_price: product.promo_price,
          stock: product.stock,
          active: product.active,
          featured: product.featured,
          on_promo: product.on_promo,
          age_group: product.age_group,
          category_id: product.category_id,
          image_urls: listing_image_urls(product),
          colors: product.colors.map do |c|
            {
              id:       c.id,
              name:     c.name,
              hex:      c.hex,
              position: c.position,
              images:   c.images.map { |img| { id: img.id, url: json_image_url(img) } },
              sizes:    c.sizes.map { |s| { id: s.id, size: s.size, stock: s.stock } }
            }
          end
        }
        if detail
          json[:description] = product.description
          json[:details] = product.details
        end
        json
      end
    end
  end
end
