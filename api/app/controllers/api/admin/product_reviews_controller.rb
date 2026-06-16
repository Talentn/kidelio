module Api
  module Admin
    class ProductReviewsController < BaseController
      def index
        reviews = ProductReview.includes(:product, :user).order(created_at: :desc).limit(500)
        render json: { reviews: reviews.map { |r| review_json(r) } }
      end

      def destroy
        review = ProductReview.find(params[:id])
        review.destroy!
        invalidate_catalog_cache
        head :no_content
      end

      private

      def review_json(review)
        {
          id: review.id,
          stars: review.stars,
          created_at: review.created_at,
          product: {
            id: review.product_id,
            name: review.product&.name,
            slug: review.product&.slug
          },
          user: review.user&.slice(:id, :name, :email),
          guest_ip: review.user_id.nil? ? review.ip_address : nil
        }
      end
    end
  end
end
