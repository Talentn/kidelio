module Api
  module Admin
    class ProductColorsController < BaseController
      before_action :set_product
      before_action :set_color, only: %i[update destroy remove_image]

      def create
        color = @product.colors.new(color_params)
        color.position = (@product.colors.maximum(:position) || -1) + 1 if color.position.nil?
        if color.save
          attach_images(color)
          invalidate_catalog_cache
          render json: { color: color_json(color.reload) }, status: :created
        else
          render json: { errors: color.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def update
        if @color.update(color_params)
          attach_images(@color)
          invalidate_catalog_cache
          render json: { color: color_json(@color.reload) }
        else
          render json: { errors: @color.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def destroy
        @color.destroy!
        invalidate_catalog_cache
        render json: { ok: true }
      end

      def remove_image
        image = @color.images.find(params[:image_id])
        image.purge
        ActivityLogger.log_media(@color, attachment: :images, detail: "Image couleur supprimée")
        invalidate_catalog_cache
        render json: { color: color_json(@color.reload) }
      end

      def reorder
        order = Array(params[:order]).map(&:to_i)
        valid_ids = @product.colors.pluck(:id)
        return render json: { error: "Ordre invalide" }, status: :unprocessable_entity unless order.sort == valid_ids.sort

        ProductColor.transaction do
          order.each_with_index do |color_id, index|
            @product.colors.find(color_id).update_column(:position, index)
          end
        end

        ActivityLogger.log(
          action: "UPDATE",
          entity: @product,
          changes: { "colors_order" => [ nil, order.map(&:to_s).join(", ") ] }
        )

        invalidate_catalog_cache
        render json: {
          colors: @product.colors.ordered.map { |c| color_json(c) }
        }
      end

      private

      def set_product
        @product = Product.find(params[:product_id])
      end

      def set_color
        @color = @product.colors.find(params[:id])
      end

      def color_params
        params.permit(:name, :hex, :position)
      end

      def attach_images(color)
        uploads = image_uploads
        return if uploads.empty?

        uploads.each do |file|
          ImageOptimizer.attach_optimized(color, :images, file)
        end
        ActivityLogger.log_media(color, attachment: :images, detail: "Images couleur ajoutées")
      end

      def image_uploads
        list = params[:images]
        list = params["images[]"] if list.blank?
        Array(list).reject(&:blank?)
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
