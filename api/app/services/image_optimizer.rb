# Web-optimized uploads: smaller files, fast page loads, high visual quality.
# Runs server-side after Active Storage attach (products, colors, categories, promos).
class ImageOptimizer
  # Longest edge — enough for retina product zoom without multi-MB originals.
  MAX_DIMENSION = 1920
  # WebP at 85 is visually near-lossless for product photos but much smaller than JPEG.
  WEBP_QUALITY = 85
  JPEG_QUALITY = 88

  def self.optimize!(blob)
    return blob unless blob.image?

    original_bytes = blob.byte_size
    original_type = blob.content_type

    blob.open do |file|
      image = MiniMagick::Image.open(file.path)
      image.auto_orient
      image.strip

      if image.width > MAX_DIMENSION || image.height > MAX_DIMENSION
        image.resize "#{MAX_DIMENSION}x#{MAX_DIMENSION}>"
      end

      output = output_settings(image, original_type)

      Tempfile.create(["optimized", output[:ext]], binmode: true) do |tmp|
        image.write(tmp.path)
        tmp.rewind
        blob.upload(tmp)
        blob.update!(content_type: output[:content_type], filename: "#{blob.filename.base}#{output[:ext]}")
      end
    end

    if blob.byte_size < original_bytes
      Rails.logger.info(
        "[ImageOptimizer] #{blob.filename} #{original_type} → #{blob.content_type}: " \
        "#{human_size(original_bytes)} → #{human_size(blob.byte_size)} " \
        "(−#{((1 - blob.byte_size.to_f / original_bytes) * 100).round}%)"
      )
    end

    blob
  rescue MiniMagick::Error, Errno::ENOENT => e
    Rails.logger.warn("[ImageOptimizer] Skipped: #{e.message}")
    blob
  end

  def self.attach_optimized(record, attachment_name, file)
    attached = record.public_send(attachment_name)
    attached.attach(file)
    blob = attached.is_a?(ActiveStorage::Attached::Many) ? attached.blobs.last : attached.blob
    optimize!(blob) if blob
    record
  end

  def self.output_settings(image, content_type)
    # Photos → WebP (best size/quality ratio in modern browsers).
    if photo_convertible?(image, content_type)
      image.format "webp"
      image.quality WEBP_QUALITY.to_s
      { content_type: "image/webp", ext: ".webp" }
    else
      case content_type
      when "image/jpeg", "image/jpg"
        image.quality JPEG_QUALITY.to_s
        image.interlace "Plane"
        image.sampling_factor "4:2:0"
        { content_type: "image/jpeg", ext: ".jpg" }
      when "image/png"
        image.define "png:compression-level=9"
        { content_type: "image/png", ext: ".png" }
      when "image/webp"
        image.quality WEBP_QUALITY.to_s
        { content_type: "image/webp", ext: ".webp" }
      else
        { content_type: content_type, ext: File.extname(image.path).presence || ".jpg" }
      end
    end
  end

  def self.photo_convertible?(image, content_type)
    return false unless content_type.in?(%w[image/jpeg image/jpg image/png image/webp])

    # Keep PNG when it has transparency (logos, overlays).
    return false if content_type == "image/png" && png_has_alpha?(image)

    true
  end

  def self.png_has_alpha?(image)
    image["%[channels]"].to_s.include?("a") || image["%[opaque]"] == "false"
  rescue MiniMagick::Error
    false
  end

  def self.human_size(bytes)
    return "#{bytes} B" if bytes < 1024

    kb = bytes / 1024.0
    return "#{'%.1f' % kb} KB" if kb < 1024

    "#{'%.1f' % (kb / 1024)} MB"
  end

  private_class_method :output_settings, :photo_convertible?, :png_has_alpha?, :human_size
end
