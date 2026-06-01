puts "Seeding Kids Shop..."

admin = User.find_or_create_by!(email: "admin@kids-shop.local") do |u|
  u.name = "Admin"
  u.password = "password123"
  u.role = :admin
end

employee = User.find_or_create_by!(email: "employee@kids-shop.local") do |u|
  u.name = "Employé"
  u.password = "password123"
  u.role = :employee
end

%w[bebe enfant ecole jouets].each_with_index do |slug, i|
  Category.find_or_create_by!(slug: slug) do |c|
    c.name = slug.capitalize
    c.position = i
    c.active = true
  end
end

cat = Category.find_by!(slug: "enfant")

products = [
  { name: "T-shirt Dinosaure", slug: "tshirt-dinosaure", price: 29.9, stock: 25, age_group: "3-6 ans", featured: true },
  { name: "Robe Princesse", slug: "robe-princesse", price: 45.0, stock: 12, age_group: "4-8 ans", featured: true },
  { name: "Pyjama Étoiles", slug: "pyjama-etoiles", price: 38.5, stock: 18, age_group: "2-5 ans" },
  { name: "Baskets Colorées", slug: "baskets-colorees", price: 65.0, stock: 8, age_group: "5-10 ans", on_promo: true, promo_price: 55.0 }
]

products.each do |attrs|
  Product.find_or_create_by!(slug: attrs[:slug]) do |p|
    p.assign_attributes(attrs.merge(category: cat, active: true, reference: "KS#{SecureRandom.hex(3).upcase}"))
  end
end

PromoCode.find_or_create_by!(code: "KIDS10") do |p|
  p.discount_type = :percentage
  p.discount_value = 10
  p.min_order_amount = 50
  p.active = true
end

HeroSlider.find_or_create_by!(title: "Collection Été") do |s|
  s.subtitle = "Nouveautés pour les petits"
  s.link_url = "/produits"
  s.position = 0
  s.active = true
end

puts "Done."
puts "Admin: #{admin.email} / password123"
puts "Employee: #{employee.email} / password123"
