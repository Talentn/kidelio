# Use ruby-vips (libvips) for image variants — much faster and lighter than
# ImageMagick, and already available in the Docker image.
Rails.application.config.active_storage.variant_processor = :vips
Rails.application.config.active_storage.track_variants = true
