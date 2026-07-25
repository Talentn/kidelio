# VAPID keys for Web Push. Resolution order: ENV → Rails credentials → a key
# pair generated once and persisted in storage/ (zero-setup for dev; set
# VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in production so keys survive rebuilds).
module WebPushConfig
  KEY_FILE = Rails.root.join("storage", "vapid_keys.json")

  class << self
    def public_key  = keys[:public_key]
    def private_key = keys[:private_key]

    def subject
      ENV["VAPID_SUBJECT"].presence || "mailto:contact@kideliowear.com"
    end

    def vapid_options
      { subject: subject, public_key: public_key, private_key: private_key }
    end

    def keys
      @keys ||= from_env || from_credentials || from_file
    end

    private

    def from_env
      pub  = ENV["VAPID_PUBLIC_KEY"].presence
      priv = ENV["VAPID_PRIVATE_KEY"].presence
      { public_key: pub, private_key: priv } if pub && priv
    end

    def from_credentials
      pub  = Rails.application.credentials.vapid_public_key.presence
      priv = Rails.application.credentials.vapid_private_key.presence
      { public_key: pub, private_key: priv } if pub && priv
    rescue StandardError
      nil
    end

    def from_file
      if File.exist?(KEY_FILE)
        data = JSON.parse(File.read(KEY_FILE), symbolize_names: true)
        return data.slice(:public_key, :private_key) if data[:public_key].present? && data[:private_key].present?
      end
      generated = WebPush.generate_key
      data = { public_key: generated.public_key, private_key: generated.private_key }
      FileUtils.mkdir_p(File.dirname(KEY_FILE))
      File.write(KEY_FILE, JSON.pretty_generate(data))
      data
    end
  end
end
