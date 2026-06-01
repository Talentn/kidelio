module Store
  class HomeController < BaseController
    def index
      @featured = Product.active.featured.includes(:category, images_attachments: :blob).limit(8)
      @sliders = HeroSlider.active
      @categories = Category.active.ordered.limit(6)
    end
  end
end
