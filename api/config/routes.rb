Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check
  get "health", to: "health#show"
  get "sitemap.xml", to: "sitemap#index", defaults: { format: :xml }

  # ── JSON API (Rails backend — all business logic) ────────────────────────
  namespace :api do
    namespace :v1 do
      get "config", to: "config#show"
      get "auth/me", to: "auth#me"
      post "auth/register", to: "auth#register"
      post "auth/login", to: "auth#login"
      delete "auth/logout", to: "auth#logout"

      get "consent", to: "consent#show"
      patch "consent", to: "consent#update"

      scope :cart, controller: "cart" do
        get "/", action: :show
        delete "/", action: :destroy
        post "items", action: :add_item
        patch "items/:product_id", action: :update_item
        delete "items/:product_id", action: :remove_item
      end

      resources :products, only: %i[index show], param: :id
      resources :categories, only: [:index]
      get 'catalog', to: 'catalog#index', defaults: { format: :json }
      get "homepage", to: "homepage#show"
      resources :hero_sliders, only: [:index], path: "hero-sliders"
      resources :promo_popups, only: [:index], path: "promo-popups"
      resources :orders, only: %i[create index show] do
        collection do
          get "track/:order_number", action: :track
        end
      end
      resources :addresses, only: %i[index create update destroy]
      post "promo-codes/validate", to: "promo_codes#validate_code"
      resources :contact_messages, only: [:create], path: "contact"
    end

    namespace :admin do
      get "dashboard/stats", to: "dashboard#stats"
      resources :products do
        resources :colors, only: %i[create update destroy], controller: "product_colors" do
          patch "reorder", on: :collection, action: :reorder
          delete "images/:image_id", to: "product_colors#remove_image", on: :member
          resources :sizes, only: %i[create update destroy], controller: "product_color_sizes"
        end
      end
      resources :orders, only: %i[index show update]
      resources :categories, only: %i[index create update destroy]
      resources :size_attributes, only: %i[index create update destroy], path: "size-attributes"
      resources :activity_logs, only: [:index], path: "activity-logs"
      resources :contact_messages, only: %i[index update], path: "contact-messages"
      resources :promo_popups, path: "promo-popups"
      resources :promo_codes, path: "promo-codes", only: %i[index create update destroy]
      resources :users, only: %i[index create update]
      get "homepage", to: "homepage#show"
      patch "homepage/assets/:key", to: "homepage#update_asset"
      resources :hero_sliders, only: %i[index create update destroy], path: "hero-sliders"
    end
  end

  # Production: serve React build (npm run build)
  devise_for :users, only: :omniauth_callbacks, controllers: { omniauth_callbacks: "users/omniauth_callbacks" }

  spa = ->(req) {
    path = req.path
    %w[/api /rails /health /up /ws /sockjs /users /sitemap.xml].none? { |p| path.start_with?(p) }
  }
  root "spa#index", constraints: spa
  get "*path", to: "spa#index", constraints: spa
end
