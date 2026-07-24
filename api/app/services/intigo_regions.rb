# Cached IntiGo cities / districts for checkout dropdowns.
class IntigoRegions
  class Error < StandardError; end

  CITIES_CACHE_KEY = "intigo/cities/v1"
  DISTRICTS_CACHE_KEY = ->(city_id) { "intigo/districts/v1/#{city_id}" }
  CACHE_TTL = 12.hours

  def self.cities
    new.cities
  end

  def self.districts(city_id)
    new.districts(city_id)
  end

  def initialize(client: IntigoClient.new)
    @client = client
  end

  def cities
    raise Error, "INTIGO_API_KEY manquante" unless @client.configured?

    Rails.cache.fetch(CITIES_CACHE_KEY, expires_in: CACHE_TTL) do
      @client.cities.map { |c| { id: c["id"], name: c["name"] } }
    end
  end

  def districts(city_id)
    raise Error, "INTIGO_API_KEY manquante" unless @client.configured?
    raise Error, "Ville invalide" if city_id.to_i <= 0

    Rails.cache.fetch(DISTRICTS_CACHE_KEY.call(city_id.to_i), expires_in: CACHE_TTL) do
      @client.districts(city_id.to_i).map { |d| { id: d["id"], name: d["name"], city_id: d["city_id"] } }
    end
  end
end
