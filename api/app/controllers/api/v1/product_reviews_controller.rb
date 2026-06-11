module Api
  module V1
    class ProductReviewsController < BaseController
      skip_before_action :verify_authenticity_token

      def create
        product = Product.active.find_by!(slug: params[:product_id])
        stars = params[:stars].to_i

        unless (1..5).cover?(stars)
          return render json: { errors: [ "La note doit être entre 1 et 5 étoiles" ] }, status: :unprocessable_entity
        end

        review = find_or_build_review(product)
        review.stars = stars
        review.ip_address = client_ip unless Current.user

        if review.save
          render json: {
            rating: rating_json(product),
            user_stars: review.stars
          }
        else
          render json: { errors: review.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def find_or_build_review(product)
        if Current.user
          product.reviews.find_or_initialize_by(user_id: Current.user.id)
        else
          product.reviews.find_or_initialize_by(user_id: nil, ip_address: client_ip)
        end
      end

      def client_ip
        request.remote_ip
      end

      def rating_json(product)
        product.rating_stats.merge(user_stars: visitor_review(product)&.stars)
      end

      def visitor_review(product)
        ProductReview.for_visitor(user: Current.user, ip: client_ip)
          .find_by(product_id: product.id)
      end
    end
  end
end
