# Run from repo root: npm run dev  (or: npm run dev:foreman)
# API + Go start first; web + admin wait for /health then proxy all traffic to Rails.
api: cd api && bundle exec rails server -p 3000 -b 127.0.0.1
go: cd go-service && RAILS_URL=http://127.0.0.1:3000 PORT=3010 DB_PATH=./data/go-service.db go run .
web: npx wait-on -t 120000 http://127.0.0.1:3000/health http://127.0.0.1:3010/health && cd web && npm start
admin: npx wait-on -t 120000 http://127.0.0.1:3000/health http://127.0.0.1:3010/health && cd admin && npm start
