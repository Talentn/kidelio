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

func sessionIDFromRequest(r *http.Request, bodySessionID string) string {
	if id := r.Header.Get("X-Session-Id"); id != "" {
		return id
	}
	if bodySessionID != "" {
		return bodySessionID
	}
	return uuid.NewString()
}

type userEventPayload struct {
	SessionID   string          `json:"session_id"`
	EventType   string          `json:"event_type"`
	Path        string          `json:"path"`
	ProductID   int64           `json:"product_id"`
	ProductName string          `json:"product_name"`
	Metadata    json.RawMessage `json:"metadata"`
}

func recordUserEvent(r *http.Request, payload userEventPayload) *store.UserEvent {
	if payload.EventType == "" {
		return nil
	}

	user, _ := middleware.ValidateSession(r)
	sessionID := sessionIDFromRequest(r, payload.SessionID)

	event := &store.UserEvent{
		ID:          uuid.NewString(),
		SessionID:   sessionID,
		EventType:   payload.EventType,
		Path:        payload.Path,
		ProductName: payload.ProductName,
	}
	if payload.ProductID != 0 {
		event.ProductID = &payload.ProductID
	}
	if user != nil {
		event.UserID = &user.ID
	}
	if len(payload.Metadata) > 0 {
		event.Metadata = string(payload.Metadata)
	}

	_ = store.SaveUserEvent(event)

	broadcastPayload := map[string]any{
		"type":  "user_event",
		"event": event,
	}
	if user != nil {
		broadcastPayload["user_name"] = user.Name
	}
	hub.Tracking.Broadcast(broadcastPayload)
	return event
}

// POST /tracking/events — browser sends navigation / product view events
func UserEventHTTP(w http.ResponseWriter, r *http.Request) {
	var payload userEventPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || recordUserEvent(r, payload) == nil {
		http.Error(w, `{"error":"invalid event"}`, http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

// GET /tracking/admin/ws — admin subscribes to live user activity feed
func TrackingAdminWS(w http.ResponseWriter, r *http.Request) {
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
	hub.Tracking.Register(client)
	defer func() {
		hub.Tracking.Unregister(client)
		conn.Close()
	}()

	go client.Pump()

	events, _ := store.RecentUserEvents(50, "")
	if events == nil {
		events = []store.UserEvent{}
	}
	client.Write(map[string]any{"type": "history", "events": events})

	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}
}

// GET /tracking/admin/events?limit=100&type=page_view — REST fallback
func GetUserEvents(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
			limit = n
		}
	}
	eventType := r.URL.Query().Get("type")
	events, err := store.RecentUserEvents(limit, eventType)
	if err != nil || events == nil {
		events = []store.UserEvent{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"events": events})
}
