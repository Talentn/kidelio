# Serves the unified React build from api/public (production).
class SpaController < ApplicationController
  skip_before_action :verify_authenticity_token

  def index
    index = Rails.public_path.join("index.html")
    return head :not_found unless index.exist?

    render file: index, layout: false
  end
end
