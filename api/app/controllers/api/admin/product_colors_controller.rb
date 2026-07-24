module Api
  module Admin
    class ProductColorsController < BaseController
      before_action :set_product
      before_action :set_color, only: %i[update destroy remove_image reorder_images]

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

      # Reorder the photos of a color. Attachments have no position column and
      # every consumer (catalog, product page, Meta feed) uses the natural row
      # order, so we recreate the attachment rows in the requested order.
      # The blobs (actual image files) are never touched: `delete` skips the
      # destroy callbacks that would schedule a blob purge.
      def reorder_images
        order = Array(params[:order]).map(&:to_i)
        attachments = @color.images_attachments.to_a
        unless order.any? && order.sort == attachments.map(&:id).sort
          return render json: { error: "Ordre invalide" }, status: :unprocessable_entity
        end

        by_id = attachments.index_by(&:id)
        blob_ids_in_order = order.map { |id| by_id[id].blob_id }

        ActiveStorage::Attachment.transaction do
          attachments.each(&:delete)
          blob_ids_in_order.each do |blob_id|
            ActiveStorage::Attachment.create!(record: @color, name: "images", blob_id: blob_id)
          end
        end

        ActivityLogger.log_media(@color, attachment: :images, detail: "Ordre des images modifié")
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
