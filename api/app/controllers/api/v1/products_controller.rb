module Api
  module V1
    class ProductsController < BaseController
      def index
        cache_key = params.slice(:category, :featured, :on_promo, :q, :age, :ids).to_json
        data = cache_response("products/index/#{cache_key}") do
          scope = Product.active.includes(:category, images_attachments: :blob,
                                          colors: { images_attachments: :blob })
          if params[:category].present?
            category = Category.find_by(id: params[:category])
            if category
              scope = scope.where(category_id: category.product_scope_ids)
            else
              scope = scope.none
            end
          end
          scope = scope.featured if params[:featured] == "true"
          scope = scope.on_promo if params[:on_promo] == "true"
          if params[:age].present?
            age = params[:age].to_s
            scope = scope.where("age_group LIKE ?", "%#{age}%")
          end
          if params[:q].present?
            q = "%#{params[:q]}%"
            scope = scope.where(
              "name LIKE ? OR description LIKE ? OR slug LIKE ?",
              q, q, q
            )
          end
          if params[:ids].present?
            ids = params[:ids].to_s.split(",").map(&:to_i).select(&:positive?).uniq.first(100)
            scope = scope.where(id: ids) if ids.any?
          end
          scope.order(created_at: :desc).map { |p| product_json(p) }
        end

        expires_in 2.minutes, public: true
        render json: { products: data }
      end

      def show
        product = Product.active
          .includes(:category, images_attachments: :blob,
                    colors: [:sizes, { images_attachments: :blob }])
          .find_by!(slug: params[:id])
        expires_in 5.minutes, public: true
        if marketing_consent?
          MetaPixelEventJob.perform_later(
            :view_content,
            product_id: product.id,
            user_context: meta_user_context
          )
        end
        render json: { product: product_json(product, detail: true) }
      end

      private

      def listing_image_urls(product, size: :medium)
        product.listing_image_attachments.filter_map { |img| json_variant_url(img, size: size) }
      end

      def product_json(product, detail: false)
        json = {
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          promo_price: product.promo_price,
          on_promo: product.on_promo,
          effective_price: product.effective_price,
          stock: product.stock,
          in_stock: product.in_stock?,
          featured: product.featured,
          age_group: product.age_group,
          category: product.category&.slice(:id, :name, :slug),
          image_urls: listing_image_urls(product, size: detail ? :large : :medium)
        }
        if detail
          json[:description] = product.description
          json[:rating] = rating_json(product)
          json[:reviews_preview] = reviews_preview_json(product)
          json[:colors] = product.colors.map do |c|
            urls = c.images.map { |img| json_variant_url(img, size: :large) }.compact
            {
              id:            c.id,
              name:          c.name,
              hex:           c.hex,
              position:      c.position,
              thumbnail_url: json_variant_url(c.images.first, size: :thumb),
              image_urls:    urls,
              sizes:         c.sizes.map { |s| { size: s.size, stock: s.stock } }
            }
          end
        end
        json
      end

      def rating_json(product)
        product.rating_stats.merge(user_stars: visitor_review(product)&.stars)
      end

      def reviews_preview_json(product)
        product.reviews
          .includes(:user)
          .order(created_at: :desc)
          .limit(5)
          .map do |review|
            {
              stars: review.stars,
              created_at: review.created_at.iso8601,
              author_name: review.user&.name.presence || "Client Kidelio"
            }
          end
      end

      def visitor_review(product)
        ProductReview.for_visitor(user: Current.user, ip: request.remote_ip)
          .find_by(product_id: product.id)
      end
    end
  end
end
