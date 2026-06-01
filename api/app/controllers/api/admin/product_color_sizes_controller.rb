module Api
  module Admin
    class ProductColorSizesController < BaseController
      before_action :set_color

      def create
        size = @color.sizes.new(size_params)
        if size.save
          render json: { color: color_json(@color.reload) }, status: :created
        else
          render json: { errors: size.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def update
        size = @color.sizes.find(params[:id])
        if size.update(size_params)
          render json: { color: color_json(@color.reload) }
        else
          render json: { errors: size.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def destroy
        @color.sizes.find(params[:id]).destroy!
        render json: { color: color_json(@color.reload) }
      end

      private

      def set_color
        product = Product.find(params[:product_id])
        @color   = product.colors.find(params[:color_id])
      end

      def size_params
        params.permit(:size, :stock, :position)
      end

      def color_json(color)
        {
          id:       color.id,
          name:     color.name,
          hex:      color.hex,
          position: color.position,
          images:   color.images.map { |img| { id: img.id, url: json_image_url(img) } },
          sizes:    color.sizes.map { |s| { id: s.id, size: s.size, stock: s.stock } }
        }
      end
    end
  end
end
