module Api
  module Admin
    class QueuesStatusController < BaseController
      before_action :require_super_ops!

      def show
        render json: {
          checked_at: Time.current.iso8601,
          puma: puma_config,
          solid_queue: solid_queue_stats,
          chat_queue: chat_queue_stats
        }
      end

      private

      def puma_config
        threads = ENV.fetch("RAILS_MAX_THREADS", 16).to_i
        workers = ENV.fetch("WEB_CONCURRENCY", 1).to_i
        {
          max_threads: threads,
          web_concurrency: workers,
          total_http_threads: threads * workers,
          solid_queue_in_puma: ENV["SOLID_QUEUE_IN_PUMA"] == "true"
        }
      end

      def solid_queue_stats
        unless defined?(SolidQueue::Job)
          return { available: false, detail: "Solid Queue non chargé" }
        end

        failed = SolidQueue::FailedExecution
          .includes(:job)
          .order(created_at: :desc)
          .limit(15)

        {
          available: true,
          counts: {
            ready: SolidQueue::ReadyExecution.count,
            scheduled: SolidQueue::ScheduledExecution.count,
            running: SolidQueue::ClaimedExecution.count,
            blocked: SolidQueue::BlockedExecution.count,
            failed: SolidQueue::FailedExecution.count,
            unfinished_jobs: SolidQueue::Job.where(finished_at: nil).count
          },
          processes: SolidQueue::Process
            .where("last_heartbeat_at >= ?", 2.minutes.ago)
            .order(last_heartbeat_at: :desc)
            .limit(10)
            .map { |p| process_json(p) },
          recent_failures: failed.map { |f| failure_json(f) },
          paused_queues: SolidQueue::Pause.pluck(:queue_name)
        }
      rescue StandardError => e
        { available: false, detail: e.message }
      end

      def process_json(process)
        {
          name: process.name,
          kind: process.kind,
          pid: process.pid,
          hostname: process.hostname,
          last_heartbeat_at: process.last_heartbeat_at&.iso8601
        }
      end

      def failure_json(failed)
        job = failed.job
        {
          job_id: failed.job_id,
          class_name: job&.class_name,
          queue_name: job&.queue_name,
          error: failed.error&.truncate(500),
          failed_at: failed.created_at.iso8601
        }
      end

      def chat_queue_stats
        res = GoServiceClient.forward(
          method: "GET",
          path: "/chat/admin/queue",
          rack_request: request,
          staff: Current.user
        )
        return { available: false, detail: "HTTP #{res.code}" } unless res.code.to_i == 200

        data = JSON.parse(res.body)
        rooms = data["queued"] || data["rooms"] || []
        {
          available: true,
          waiting_count: rooms.size,
          rooms: rooms.first(20).map do |r|
            {
              id: r["id"],
              user_name: r["user_name"],
              user_email: r["user_email"],
              status: r["status"],
              created_at: r["created_at"]
            }
          end
        }
      rescue StandardError => e
        { available: false, detail: e.message }
      end
    end
  end
end
