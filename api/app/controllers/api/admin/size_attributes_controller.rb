module Api
  module Admin
    class SizeAttributesController < BaseController
      def index
        render json: { sizes: SizeAttribute.ordered.map { |s| size_json(s) } }
      end

      def create
        size = SizeAttribute.new(size_params)
        if size.save
          render json: { size: size_json(size) }, status: :created
        else
          render json: { errors: size.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def update
        size = SizeAttribute.find(params[:id])
        if size.update(size_params)
          render json: { size: size_json(size) }
        else
          render json: { errors: size.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def destroy
        SizeAttribute.find(params[:id]).destroy!
        render json: { ok: true }
      end

      private

      def size_params
        params.permit(:name, :position)
      end

      def size_json(s)
        { id: s.id, name: s.name, position: s.position }
      end
    end
  end
end
