class SitemapController < ApplicationController
  BASE_URL = "https://kideliowear.com"

  STATIC_ROUTES = [
    { loc: "/",         changefreq: "daily",   priority: "1.0" },
    { loc: "/produits", changefreq: "daily",   priority: "0.9" },
    { loc: "/contact",  changefreq: "monthly", priority: "0.5" },
  ].freeze

  def index
    products = Product.where(active: true).select(:slug, :updated_at)

    respond_to do |format|
      format.xml do
        render xml: build_sitemap(products), content_type: "application/xml"
      end
    end
  end

  private

  def build_sitemap(products)
    builder = Nokogiri::XML::Builder.new(encoding: "UTF-8") do |xml|
      xml.urlset(
        xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9",
        "xmlns:xhtml": "http://www.w3.org/1999/xhtml"
      ) do
        STATIC_ROUTES.each do |route|
          xml.url do
            xml.loc "#{BASE_URL}#{route[:loc]}"
            xml.changefreq route[:changefreq]
            xml.priority route[:priority]
          end
        end

        products.each do |product|
          xml.url do
            xml.loc "#{BASE_URL}/produits/#{product.slug}"
            xml.lastmod product.updated_at.utc.strftime("%Y-%m-%d")
            xml.changefreq "weekly"
            xml.priority "0.8"
          end
        end
      end
    end

    builder.to_xml
  end
end
