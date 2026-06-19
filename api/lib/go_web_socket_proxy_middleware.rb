# Proxies WebSocket upgrades on /api/v1/{chat,cart,favorites}/... to go-service.
class GoWebSocketProxyMiddleware
  WS_PATH = %r{\A/api/v1/(chat/ws/|chat/admin/ws\z|cart/ws\z|cart/admin/ws\z|favorites/ws\z|favorites/admin/ws\z|tracking/admin/ws\z)}.freeze

  def initialize(app)
    @app = app
    @proxy = GoServiceProxy.new
  end

  def call(env)
    if websocket_upgrade?(env) && env["PATH_INFO"].match?(WS_PATH)
      env = env.dup
      env["PATH_INFO"] = env["PATH_INFO"].sub(%r{\A/api/v1}, "")
      @proxy.call(env)
    else
      @app.call(env)
    end
  end

  private

  def websocket_upgrade?(env)
    env["HTTP_UPGRADE"]&.casecmp("websocket")&.zero?
  end
end
