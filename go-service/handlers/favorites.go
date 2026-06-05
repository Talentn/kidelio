package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/kidelio/go-service/hub"
	"github.com/kidelio/go-service/middleware"
	"github.com/kidelio/go-service/store"
)

// ── WS /favorites/ws — browser sends add/remove events ────────────────────────

func FavoriteEventWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	user, _ := middleware.ValidateSession(r)
	sessionID := r.Header.Get("X-Session-Id")
	if sessionID == "" {
		sessionID = uuid.NewString()
	}

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var payload struct {
			Action      string `json:"action"`
			ProductID   int64  `json:"product_id"`
			ProductName string `json:"product_name"`
		}
		if err := json.Unmarshal(raw, &payload); err != nil || payload.Action == "" {
			continue
		}

		event := &store.FavoriteEvent{
			ID:          uuid.NewString(),
			SessionID:   sessionID,
			Action:      payload.Action,
			ProductName: payload.ProductName,
		}
		if payload.ProductID != 0 {
			event.ProductID = &payload.ProductID
		}
		if user != nil {
			event.UserID = &user.ID
		}

		_ = store.SaveFavoriteEvent(event)

		broadcastPayload := map[string]any{
			"type":  "favorite_event",
			"event": event,
		}
		if user != nil {
			broadcastPayload["user_name"] = user.Name
		}
		hub.Favorites.Broadcast(broadcastPayload)
	}
}

// ── WS /favorites/admin/ws — admin subscribes to live favorites feed ───────────

func FavoritesAdminWS(w http.ResponseWriter, r *http.Request) {
	user, err := middleware.ValidateSession(r)
	if err != nil || (user.Role != "admin" && user.Role != "employee") {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &hub.Client{Conn: conn, Send: make(chan []byte, 128)}
	hub.Favorites.Register(client)
	defer func() {
		hub.Favorites.Unregister(client)
		conn.Close()
	}()

	go client.Pump()

	events, _ := store.RecentFavoriteEvents(50)
	if events == nil {
		events = []store.FavoriteEvent{}
	}
	client.Write(map[string]any{"type": "history", "events": events})

	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}
}

// ── GET /favorites/admin/events?limit=100 — REST fallback ──────────────────────

func GetFavoriteEvents(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
			limit = n
		}
	}
	events, err := store.RecentFavoriteEvents(limit)
	if err != nil || events == nil {
		events = []store.FavoriteEvent{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"events": events})
}
