module Api
  module V1
    class ContactMessagesController < BaseController
      skip_before_action :verify_authenticity_token, only: :create

      def create
        msg = ContactMessage.new(contact_params)
        if msg.save
          SendWebPushJob.perform_later(
            "message",
            title: "Nouveau message de #{msg.name}",
            body: msg.message.to_s.truncate(120),
            url: "/admin/messages",
            tag: "kidelio-message"
          )
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
