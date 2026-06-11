Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check
  get "health", to: "health#show"
  get "sitemap.xml", to: "sitemap#index", defaults: { format: :xml }

  # ── JSON API (Rails backend — all business logic) ────────────────────────
  namespace :api do
    namespace :v1 do
      # Go service REST — explicit routes (shared nginx steals /api/v1/realtime, /go, etc.)
      post "chat/rooms", to: "go_proxy#create_chat_room"
      get "chat/rooms/:room_id/messages", to: "go_proxy#chat_room_messages"
      post "chat/rooms/:room_id/messages", to: "go_proxy#chat_room_send_message"
      get "chat/admin/queue", to: "go_proxy#chat_admin_queue"
      get "chat/admin/archives", to: "go_proxy#chat_admin_archives"
      get "chat/admin/rooms/:room_id", to: "go_proxy#chat_admin_room"
      post "chat/admin/rooms/:room_id/join", to: "go_proxy#chat_admin_join"
      post "chat/admin/rooms/:room_id/messages", to: "go_proxy#chat_admin_message"
      post "chat/admin/rooms/:room_id/close", to: "go_proxy#chat_admin_close"
      post "cart/events", to: "go_proxy#cart_events"
      post "favorites/events", to: "go_proxy#favorites_events"
      get "cart/admin/events", to: "go_proxy#cart_admin_events"
      get "favorites/admin/events", to: "go_proxy#favorites_admin_events"

      get "store", to: "config#show"
      get "config", to: "config#show" # legacy alias (often blocked by ad blockers)
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

      resources :products, only: %i[index show], param: :id do
        post "review", to: "product_reviews#create"
      end
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
      get "rewards", to: "rewards#show"
      post "rewards/claim", to: "rewards#claim"
      resources :contact_messages, only: [:create], path: "contact"
    end

    namespace :admin do
      get "dashboard/stats", to: "dashboard#stats"
      get "statistics", to: "statistics#show"
      get "system-status", to: "system_status#show"
      get "queues-status", to: "queues_status#show"
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
      resources :users, only: %i[index create update destroy]
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
