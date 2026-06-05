puts "Seeding Kidelio..."

admin_email    = ENV.fetch("ADMIN_EMAIL",    "admin@kideliowear.com")
admin_password = ENV.fetch("ADMIN_PASSWORD", SecureRandom.hex(16))

admin = User.find_or_create_by!(email: admin_email) do |u|
  u.name     = "Admin"
  u.password = admin_password
  u.role     = :admin
end

%w[bebe enfant ecole jouets].each_with_index do |slug, i|
  Category.find_or_create_by!(slug: slug) do |c|
    c.name     = slug.capitalize
    c.position = i
    c.active   = true
  end
end

puts "Done."
puts "Admin: #{admin.email}"
