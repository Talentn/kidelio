# Sends a Web Push notification to every staff device subscribed to the given
# event ("order", "chat" or "message"). Expired/revoked subscriptions are pruned.
class SendWebPushJob < ApplicationJob
  queue_as :default

  def perform(event, title:, body:, url: "/admin", tag: nil)
    subscriptions = PushSubscription.for_event(event)
    return if subscriptions.none?

    payload = {
      title: title,
      body: body,
      url: url,
      tag: tag || "kidelio-#{event}",
      icon: "/android-chrome-192x192.png"
    }.to_json

    subscriptions.find_each { |sub| deliver(sub, payload) }
  end

  private

  def deliver(sub, payload)
    WebPush.payload_send(
      message: payload,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      ttl: 4.hours.to_i,
      urgency: "high",
      vapid: WebPushConfig.vapid_options
    )
  rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription, WebPush::Unauthorized
    sub.destroy
  rescue WebPush::ResponseError => e
    Rails.logger.warn("[SendWebPushJob] push to subscription #{sub.id} failed: #{e.message}")
  end
end
