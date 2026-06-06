# Proxies /api/v1/realtime/* to the Go service (chat, cart events, favorites).
# Do not use /api/v1/live — shared daizo-nginx reserves "live" for another app (Next.js).
require "rack/proxy"

class GoServiceProxy < Rack::Proxy
  def initialize(app = nil, options = {})
    @target = URI.parse(options[:target] || ENV.fetch("GO_SERVICE_URL", "http://127.0.0.1:3010"))
    super(app, streaming: true)
  end

  def rewrite_env(env)
    env["HTTP_HOST"] = "#{@target.host}:#{@target.port}"
    env["HTTP_X_FORWARDED_PROTO"] ||= env["rack.url_scheme"]
    env["HTTP_X_FORWARDED_FOR"] ||= env["REMOTE_ADDR"]
    env
  end

  def rewrite_url(_uri, env)
    path = env["PATH_INFO"]
    qs = env["QUERY_STRING"]
    url = "#{@target}#{path}"
    url += "?#{qs}" if qs.present?
    URI(url)
  end
end
