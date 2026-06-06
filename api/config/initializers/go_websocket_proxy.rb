require Rails.root.join("lib/go_service_proxy")
require Rails.root.join("lib/go_websocket_proxy_middleware")

Rails.application.config.middleware.insert_before 0, GoWebSocketProxyMiddleware
