module Api
  module V1
    class ContactMessagesController < BaseController
      skip_before_action :verify_authenticity_token, only: :create

      def create
        msg = ContactMessage.new(contact_params)
        if msg.save
          render json: { ok: true }, status: :created
        else
          render json: { errors: msg.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def contact_params
        params.permit(:name, :email, :phone, :message)
      end
    end
  end
end
