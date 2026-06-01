module Store
  class ContactController < BaseController
    def new
    end

    def create
      msg = ContactMessage.new(contact_params)
      if msg.save
        redirect_to root_path, notice: "Message envoyé. Merci !"
      else
        flash.now[:alert] = msg.errors.full_messages.to_sentence
        render :new, status: :unprocessable_entity
      end
    end

    private

    def contact_params
      params.permit(:name, :email, :phone, :message)
    end
  end
end
