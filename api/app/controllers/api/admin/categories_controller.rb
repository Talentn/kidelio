module Api
  module Admin
    class CategoriesController < BaseController
      def index
        roots = Category.includes(:children, image_attachment: :blob)
                        .roots
                        .ordered
        render json: { categories: roots.map { |c| category_tree_json(c) } }
      end

      def create
        category = Category.new(category_params)
        if category.save
          attach_image(category)
          invalidate_catalog_cache
          render json: { category: category_tree_json(category) }, status: :created
        else
          render json: { errors: category.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def update
        category = Category.find(params[:id])
        if category.update(category_params)
          attach_image(category)
          invalidate_catalog_cache
          render json: { category: category_tree_json(category) }
        else
          render json: { errors: category.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def destroy
        category = Category.find(params[:id])
        category.destroy!
        invalidate_catalog_cache
        head :no_content
      end

      private

      def category_params
        raw = params.permit(:name, :slug, :description, :position, :active, :parent_id)
        raw[:parent_id] = nil if raw[:parent_id].blank?
        cast_booleans(raw, :active)
      end

      def attach_image(category)
        return unless params[:image].present?

        ImageOptimizer.attach_optimized(category, :image, params[:image])
        ActivityLogger.log_media(category, attachment: :image, detail: "Image catégorie mise à jour")
      end

      def category_json(category)
        {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          position: category.position,
          active: category.active,
          parent_id: category.parent_id,
          parent_name: category.parent&.name,
          image_url: json_image_url(category.image),
          products_count: category.products.count,
          children_count: category.children.size
        }
      end

      def category_tree_json(category)
        base = category_json(category)
        if category.root?
          base.merge(
            children: category.children.map { |child| category_json(child) }
          )
        else
          base.merge(children: [])
        end
      end
    end
  end
end
