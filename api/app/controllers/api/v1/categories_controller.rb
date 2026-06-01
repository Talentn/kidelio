module Api
  module V1
    class CategoriesController < BaseController
      def index
        data = cache_response("categories") do
          Category.active
                  .includes(:children, image_attachment: :blob)
                  .roots
                  .ordered
                  .map { |c| category_tree_json(c) }
        end
        expires_in 10.minutes, public: true
        render json: { categories: data }
      end

      private

      def category_tree_json(category)
        {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          image_url: json_image_url(category.image),
          children: category.children.active.map do |child|
            {
              id: child.id,
              name: child.name,
              slug: child.slug,
              description: child.description,
              image_url: json_image_url(child.image),
              parent_id: child.parent_id
            }
          end
        }
      end
    end
  end
end
