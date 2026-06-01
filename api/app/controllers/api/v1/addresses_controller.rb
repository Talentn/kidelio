module Api
  module V1
    class AddressesController < BaseController
      skip_before_action :verify_authenticity_token

      before_action :require_user!
      before_action :set_address, only: %i[update destroy]

      def index
        Address.sync_from_orders!(Current.user)
        render json: { addresses: Current.user.addresses.ordered.map { |a| address_json(a) } }
      end

      def create
        address = Current.user.addresses.new(address_params)
        if address.save
          render json: { address: address_json(address) }, status: :created
        else
          render json: { errors: address.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def update
        if @address.update(address_params)
          render json: { address: address_json(@address) }
        else
          render json: { errors: @address.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def destroy
        @address.destroy!
        head :no_content
      end

      private

      def set_address
        @address = Current.user.addresses.find(params[:id])
      end

      def address_params
        params.permit(:full_name, :phone, :governorate, :delegation, :street_address, :postal_code, :label, :is_default)
      end

      def address_json(address)
        {
          id: address.id,
          full_name: address.full_name,
          phone: address.phone,
          governorate: address.governorate,
          delegation: address.delegation,
          street_address: address.street_address,
          postal_code: address.postal_code,
          label: address.label,
          is_default: address.is_default
        }
      end
    end
  end
end
