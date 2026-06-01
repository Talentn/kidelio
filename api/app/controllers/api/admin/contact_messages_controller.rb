module Api
  module Admin
    class ContactMessagesController < BaseController
      def index
        messages = ContactMessage.order(created_at: :desc)
        render json: { messages: messages.map { |m| message_json(m) } }
      end

      def update
        message = ContactMessage.find(params[:id])
        message.update!(read: true)
        render json: { message: message_json(message) }
      end

      private

      def message_json(m)
        m.slice(:id, :name, :email, :phone, :message, :read, :created_at)
      end
    end
  end
end
