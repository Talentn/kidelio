module Admin
  class ProductsController < BaseController
    before_action :set_product, only: %i[show edit update]

    def index
      @products = Product.includes(:category).order(created_at: :desc)
    end

    def show
    end

    def new
      @product = Product.new(active: true)
      @categories = Category.active.ordered
    end

    def create
      @product = Product.new(product_params)
      attach_images
      if @product.save
        invalidate_catalog_cache
        redirect_to admin_product_path(@product), notice: "Produit créé."
      else
        @categories = Category.active.ordered
        render :new, status: :unprocessable_entity
      end
    end

    def edit
      @categories = Category.active.ordered
    end

    def update
      attach_images
      if @product.update(product_params)
        invalidate_catalog_cache
        redirect_to admin_product_path(@product), notice: "Produit mis à jour."
      else
        @categories = Category.active.ordered
        render :edit, status: :unprocessable_entity
      end
    end

    private

    def set_product
      @product = Product.find(params[:id])
    end

    def product_params
      params.require(:product).permit(
        :name, :slug, :reference, :description, :price, :promo_price,
        :stock, :active, :featured, :on_promo, :category_id, :age_group
      )
    end

    def attach_images
      return unless params[:images].present?

      Array(params[:images]).each do |file|
        ImageOptimizer.attach_optimized(@product, :images, file)
      end
    end

    def invalidate_catalog_cache
      Rails.cache.delete_matched(/^v1\//) rescue Rails.cache.clear
    end
  end
end
