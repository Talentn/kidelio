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

type cartEventPayload struct {
	Action      string  `json:"action"`
	SessionID   string  `json:"session_id"`
	ProductID   int64   `json:"product_id"`
	ProductName string  `json:"product_name"`
	Quantity    int     `json:"quantity"`
	Price       float64 `json:"price"`
	ColorID     int64   `json:"color_id"`
	ColorLabel  string  `json:"color_label"`
	SizeLabel   string  `json:"size_label"`
}

func recordCartEvent(r *http.Request, payload cartEventPayload) *store.CartEvent {
	if payload.Action == "" {
		return nil
	}

	user, _ := middleware.ValidateSession(r)
	sessionID := sessionIDFromRequest(r, payload.SessionID)

	event := &store.CartEvent{
		ID:          uuid.NewString(),
		SessionID:   sessionID,
		Action:      payload.Action,
		ProductName: payload.ProductName,
		Quantity:    payload.Quantity,
		Price:       payload.Price,
		ColorLabel:  payload.ColorLabel,
		SizeLabel:   payload.SizeLabel,
	}
	if payload.ProductID != 0 {
		event.ProductID = &payload.ProductID
	}
	if payload.ColorID != 0 {
		event.ColorID = &payload.ColorID
	}
	if user != nil {
		event.UserID = &user.ID
	}

	_ = store.SaveCartEvent(event)

	broadcastPayload := map[string]any{
		"type":  "cart_event",
		"event": event,
	}
	if user != nil {
		broadcastPayload["user_name"] = user.Name
	}
	hub.Cart.Broadcast(broadcastPayload)
	return event
}

// POST /cart/events — HTTP fallback when WebSocket unavailable
func CartEventHTTP(w http.ResponseWriter, r *http.Request) {
	var payload cartEventPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || recordCartEvent(r, payload) == nil {
		http.Error(w, `{"error":"invalid event"}`, http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

// ── WS /cart/ws — browser sends add/remove events ─────────────────────────────

func CartEventWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var payload cartEventPayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			continue
		}
		recordCartEvent(r, payload)
	}
}

// ── WS /cart/admin/ws — admin subscribes to live cart feed ───────────────────

func CartAdminWS(w http.ResponseWriter, r *http.Request) {
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
	hub.Cart.Register(client)
	defer func() {
		hub.Cart.Unregister(client)
		conn.Close()
	}()

	go client.Pump()

	// Send last 50 events on connect
	events, _ := store.RecentCartEvents(50)
	if events == nil {
		events = []store.CartEvent{}
	}
	client.Write(map[string]any{"type": "history", "events": events})

	// Keep alive (read loop discards pings)
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}
}

// ── GET /cart/admin/events?limit=100 — REST fallback ─────────────────────────

func GetCartEvents(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
			limit = n
		}
	}
	events, err := store.RecentCartEvents(limit)
	if err != nil || events == nil {
		events = []store.CartEvent{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"events": events})
}
