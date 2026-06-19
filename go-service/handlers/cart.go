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
	Event       string  `json:"event"`
	SessionID   string  `json:"session_id"`
	UserID      int64   `json:"user_id"`
	ProductID   int64   `json:"product_id"`
	ProductName string  `json:"product_name"`
	Quantity    int     `json:"quantity"`
	Price       float64 `json:"price"`
	ColorID     int64   `json:"color_id"`
	ColorLabel  string  `json:"color_label"`
	SizeLabel   string  `json:"size_label"`
}

func cartEventAction(payload cartEventPayload) string {
	if payload.Event != "" {
		return payload.Event
	}
	return payload.Action
}

func recordCartEvent(r *http.Request, payload cartEventPayload) *store.CartEvent {
	action := cartEventAction(payload)
	if action == "" {
		return nil
	}

	user, _ := middleware.ValidateSession(r)
	sessionID := sessionIDFromRequest(r, payload.SessionID)

	event := &store.CartEvent{
		ID:          uuid.NewString(),
		SessionID:   sessionID,
		Action:      action,
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
	} else if payload.UserID != 0 {
		event.UserID = &payload.UserID
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

// POST /cart/signals — browser or Rails records cart activity (avoid /events — ad blockers)
func CartSignalHTTP(w http.ResponseWriter, r *http.Request) {
	var payload cartEventPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || recordCartEvent(r, payload) == nil {
		http.Error(w, `{"error":"invalid event"}`, http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

// POST /cart/events — legacy alias
func CartEventHTTP(w http.ResponseWriter, r *http.Request) {
	CartSignalHTTP(w, r)
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

// GET /cart/admin/signals?limit=100 — REST fallback (admin history)
func GetCartSignals(w http.ResponseWriter, r *http.Request) {
	GetCartEvents(w, r)
}

// GET /cart/admin/events?limit=100 — legacy alias
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
