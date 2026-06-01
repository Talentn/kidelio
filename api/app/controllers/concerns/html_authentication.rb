module HtmlAuthentication
  extend ActiveSupport::Concern

  private

  def require_user_html!
    return if Current.user

    redirect_to new_store_session_path, alert: "Connectez-vous pour continuer."
  end

  def require_staff_html!
    unless Current.user&.staff?
      redirect_to new_admin_session_path, alert: "Accès réservé au personnel."
    end
  end
end
