module Admin
  class BaseController < ApplicationController
    include HtmlAuthentication
    layout "admin"
    before_action :require_staff_html!
  end
end
