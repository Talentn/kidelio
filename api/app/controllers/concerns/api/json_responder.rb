module Api
  module JsonResponder
    extend ActiveSupport::Concern

    private

    def render_json(data = {}, status: :ok, meta: {})
      render json: { ok: true, data: data, meta: meta }, status: status
    end

    def render_json_error(message, status: :unprocessable_entity, errors: nil)
      body = { ok: false, error: message }
      body[:errors] = errors if errors
      render json: body, status: status
    end
  end
end
