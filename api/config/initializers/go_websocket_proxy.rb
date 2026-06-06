# Loaded explicitly — initializers run before Zeitwerk eager load in production.
require Rails.root.join("lib/go_service_proxy")
require Rails.root.join("lib/go_web_socket_proxy_middleware")

Rails.application.config.middleware.insert_before 0, GoWebSocketProxyMiddleware
