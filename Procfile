# Run from repo root: npm run dev
# API starts first; web + admin wait for /health then proxy all traffic to Rails.
api: cd api && bundle exec rails server -p 3000 -b 127.0.0.1
web: npx wait-on -t 120000 http://127.0.0.1:3000/health && cd web && npm start
admin: npx wait-on -t 120000 http://127.0.0.1:3000/health && cd admin && npm start
