module Api
  module Admin
    class SystemStatusController < BaseController
      before_action :require_super_ops!

      def show
        services = [
          check_rails,
          check_database,
          check_go_service,
          check_cache,
          check_storage,
          check_queue,
          check_store_config
        ]

        statuses = services.map { |s| s[:status] }
        overall =
          if statuses.any? { |s| s == "down" }
            "down"
          elsif statuses.any? { |s| s == "degraded" }
            "degraded"
          else
            "healthy"
          end

        render json: {
          checked_at: Time.current.iso8601,
          overall: overall,
          services: services,
          environment: {
            rails_env: Rails.env,
            site_url: ENV["SITE_URL"],
            go_service_url: ENV.fetch("GO_SERVICE_URL", "http://127.0.0.1:3010"),
            solid_queue_in_puma: ENV["SOLID_QUEUE_IN_PUMA"] == "true",
            google_auth_configured: google_auth_configured?,
            meta_pixel_configured: meta_pixel_configured?
          }
        }
      end

      private

      def check_rails
        service("rails", "Rails API", "ok", detail: "Puma actif")
      end

      def check_database
        ms = benchmark_ms { ActiveRecord::Base.connection.execute("SELECT 1") }
        service("database", "Base de données", "ok", latency_ms: ms, detail: adapter_name)
      rescue StandardError => e
        service("database", "Base de données", "down", detail: e.message)
      end

      def check_go_service
        uri = URI("#{GoServiceClient.base_uri}/health")
        ms = benchmark_ms do
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = uri.scheme == "https"
          http.open_timeout = 3
          http.read_timeout = 3
          res = http.get(uri.path)
          raise "HTTP #{res.code}" unless res.code.to_i == 200
        end
        service("go_service", "Go (chat & temps réel)", "ok", latency_ms: ms)
      rescue StandardError => e
        service("go_service", "Go (chat & temps réel)", "down", detail: e.message)
      end

      def check_cache
        key = "system_status:#{Time.current.to_i}"
        ms = benchmark_ms do
          Rails.cache.write(key, "1", expires_in: 10.seconds)
          raise "cache read failed" unless Rails.cache.read(key) == "1"
        end
        service("cache", "Cache (Solid)", "ok", latency_ms: ms)
      rescue StandardError => e
        service("cache", "Cache (Solid)", "degraded", detail: e.message)
      end

      def check_storage
        path = Rails.root.join("storage")
        writable = path.directory? && File.writable?(path)
        status = writable ? "ok" : "down"
        service("storage", "Stockage fichiers", status, detail: writable ? path.to_s : "non accessible en écriture")
      rescue StandardError => e
        service("storage", "Stockage fichiers", "down", detail: e.message)
      end

      def check_queue
        unless defined?(SolidQueue::Job)
          return service("queue", "Jobs (Solid Queue)", "degraded", detail: "Solid Queue non chargé")
        end

        ms = benchmark_ms { SolidQueue::Job.limit(1).pluck(:id) }
        service("queue", "Jobs (Solid Queue)", "ok", latency_ms: ms)
      rescue StandardError => e
        service("queue", "Jobs (Solid Queue)", "degraded", detail: e.message)
      end

      def check_store_config
        ms = benchmark_ms { Product.count }
        service("store_api", "Catalogue produits", "ok", latency_ms: ms, detail: "#{Product.count} produits")
      rescue StandardError => e
        service("store_api", "Catalogue produits", "down", detail: e.message)
      end

      def service(id, name, status, latency_ms: nil, detail: nil)
        {
          id: id,
          name: name,
          status: status,
          latency_ms: latency_ms,
          detail: detail
        }.compact
      end

      def benchmark_ms
        start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        yield
        ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).round(1)
      end

      def adapter_name
        ActiveRecord::Base.connection.adapter_name
      rescue StandardError
        "unknown"
      end

      def google_auth_configured?
        (ENV["GOOGLE_CLIENT_ID"].presence || Rails.application.credentials.dig(:google_client_id)).present?
      end

      def meta_pixel_configured?
        ENV["META_PIXEL_ID"].present? || ENV["META_ACCESS_TOKEN"].present?
      end
    end
  end
end
