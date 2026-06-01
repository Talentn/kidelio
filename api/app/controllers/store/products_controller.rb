module Store
  class ProductsController < BaseController
    def index
      @categories = Category.active.ordered
      scope = Product.active.includes(:category, images_attachments: :blob)
      scope = scope.where(category_id: params[:category]) if params[:category].present?
      scope = scope.where("name LIKE ?", "%#{params[:q]}%") if params[:q].present?
      @products = scope.order(created_at: :desc)
    end

    def show
      @product = Product.active.find_by!(slug: params[:id])
      @related = Product.active.where(category_id: @product.category_id)
        .where.not(id: @product.id).limit(4)
    end
  end
end
