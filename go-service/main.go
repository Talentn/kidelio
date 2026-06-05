package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/kidelio/go-service/handlers"
	"github.com/kidelio/go-service/middleware"
	"github.com/kidelio/go-service/store"
)

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/go-service.db"
	}
	_ = os.MkdirAll(filepath.Dir(dbPath), 0755)
	store.Init(dbPath)

	mux := http.NewServeMux()

	// ── Chat ─────────────────────────────────────────────────────────────────
	// Customer: start a chat room (rate-limited)
	mux.HandleFunc("POST /chat/rooms", middleware.RateLimit(10, time.Minute, handlers.CreateRoom))
	// Customer: get message history
	mux.HandleFunc("GET /chat/rooms/{id}/messages", handlers.GetMessages)
	// Customer: WebSocket
	mux.HandleFunc("GET /chat/ws/{id}", handlers.CustomerWS)

	// Agent: WebSocket (auth checked inside)
	mux.HandleFunc("GET /chat/admin/ws", handlers.AgentWS)
	// Agent: queue snapshot (REST fallback)
	mux.HandleFunc("GET /chat/admin/queue", middleware.RequireStaff(handlers.GetQueue))
	// Agent: reliable HTTP actions (join / send / close)
	mux.HandleFunc("POST /chat/admin/rooms/{id}/join", handlers.AdminJoinRoom)
	mux.HandleFunc("POST /chat/admin/rooms/{id}/messages", handlers.AdminSendMessage)
	mux.HandleFunc("POST /chat/admin/rooms/{id}/close", handlers.AdminCloseRoom)

	// ── Cart events ──────────────────────────────────────────────────────────
	// Browser: send cart events
	mux.HandleFunc("GET /cart/ws", handlers.CartEventWS)
	// Admin: subscribe to live feed
	mux.HandleFunc("GET /cart/admin/ws", handlers.CartAdminWS)
	// Admin: REST history
	mux.HandleFunc("GET /cart/admin/events", middleware.RequireStaff(handlers.GetCartEvents))

	// ── Favorite events ──────────────────────────────────────────────────────
	mux.HandleFunc("GET /favorites/ws", handlers.FavoriteEventWS)
	mux.HandleFunc("GET /favorites/admin/ws", handlers.FavoritesAdminWS)
	mux.HandleFunc("GET /favorites/admin/events", middleware.RequireStaff(handlers.GetFavoriteEvents))

	// ── Health ────────────────────────────────────────────────────────────────
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"ok":true}`))
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "3010"
	}

	log.Printf("go-service listening on :%s", port)
	if err := http.ListenAndServe(":"+port, middleware.CORS(mux)); err != nil {
		log.Fatal(err)
	}
}
