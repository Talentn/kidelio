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
	// Customer: get message history / send via HTTP when WebSocket unavailable
	mux.HandleFunc("GET /chat/rooms/{id}/messages", handlers.GetMessages)
	mux.HandleFunc("POST /chat/rooms/{id}/messages", middleware.RateLimit(60, time.Minute, handlers.CustomerSendMessage))
	// Customer: WebSocket
	mux.HandleFunc("GET /chat/ws/{id}", handlers.CustomerWS)

	// Agent: WebSocket (auth checked inside)
	mux.HandleFunc("GET /chat/admin/ws", handlers.AgentWS)
	// Agent: queue snapshot (REST fallback)
	mux.HandleFunc("GET /chat/admin/queue", middleware.RequireStaff(handlers.GetQueue))
	mux.HandleFunc("GET /chat/admin/archives", middleware.RequireStaff(handlers.GetArchives))
	mux.HandleFunc("GET /chat/admin/rooms/{id}", middleware.RequireStaff(handlers.GetAdminRoom))
	mux.HandleFunc("DELETE /chat/admin/rooms/{id}", middleware.RequireStaff(handlers.AdminDeleteRoom))
	// Agent: reliable HTTP actions (join / send / close)
	mux.HandleFunc("POST /chat/admin/rooms/{id}/join", handlers.AdminJoinRoom)
	mux.HandleFunc("POST /chat/admin/rooms/{id}/messages", handlers.AdminSendMessage)
	mux.HandleFunc("POST /chat/admin/rooms/{id}/close", handlers.AdminCloseRoom)

	// ── Cart events ──────────────────────────────────────────────────────────
	// Browser: send cart events (HTTP when WebSocket unavailable)
	mux.HandleFunc("POST /cart/events", middleware.RateLimit(120, time.Minute, handlers.CartEventHTTP))
	mux.HandleFunc("GET /cart/ws", handlers.CartEventWS)
	// Admin: subscribe to live feed
	mux.HandleFunc("GET /cart/admin/ws", handlers.CartAdminWS)
	// Admin: REST history
	mux.HandleFunc("GET /cart/admin/events", middleware.RequireStaff(handlers.GetCartEvents))

	// ── Favorite events ──────────────────────────────────────────────────────
	mux.HandleFunc("POST /favorites/events", middleware.RateLimit(120, time.Minute, handlers.FavoriteEventHTTP))
	mux.HandleFunc("GET /favorites/ws", handlers.FavoriteEventWS)
	mux.HandleFunc("GET /favorites/admin/ws", handlers.FavoritesAdminWS)
	mux.HandleFunc("GET /favorites/admin/events", middleware.RequireStaff(handlers.GetFavoriteEvents))

	// ── User activity tracking ────────────────────────────────────────────────
	mux.HandleFunc("POST /tracking/events", middleware.RateLimit(180, time.Minute, handlers.UserEventHTTP))
	mux.HandleFunc("GET /tracking/admin/ws", handlers.TrackingAdminWS)
	mux.HandleFunc("GET /tracking/admin/events", middleware.RequireStaff(handlers.GetUserEvents))

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
