package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/kidelio/go-service/hub"
	"github.com/kidelio/go-service/middleware"
	"github.com/kidelio/go-service/store"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:     middleware.AllowedOrigin,
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type wsMsg struct {
	Type    string `json:"type"`
	Content string `json:"content,omitempty"`
	RoomID  string `json:"room_id,omitempty"`
	Name    string `json:"name,omitempty"`
	Email   string `json:"email,omitempty"`
}

// ── POST /chat/rooms — customer starts a chat ─────────────────────────────────

func CreateRoom(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		http.Error(w, `{"error":"name required"}`, http.StatusBadRequest)
		return
	}

	// Optional: enrich with Rails user if logged in
	user, _ := middleware.ValidateSession(r)

	room := &store.Room{
		ID:        uuid.NewString(),
		UserName:  body.Name,
		UserEmail: body.Email,
		Status:    "queued",
	}
	if user != nil {
		room.UserID = &user.ID
		room.UserName = user.Name
		room.UserEmail = user.Email
	}

	if err := store.CreateRoom(room); err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}

	// Add system welcome message
	welcome := &store.Message{
		ID:         uuid.NewString(),
		RoomID:     room.ID,
		SenderType: "system",
		SenderName: "Kidelio",
		Content:    "Bienvenue ! Un conseiller va vous rejoindre dans quelques instants. 🐰",
	}
	_ = store.SaveMessage(welcome)

	// Notify all connected agents of the new queued chat
	hub.Chat.BroadcastToAgents(map[string]any{
		"type": "queue_update",
		"room": room,
	})
	refreshQueue()
	refreshQueuePositions()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"room_id": room.ID})
}

// ── GET /chat/rooms/:id/messages ──────────────────────────────────────────────

func GetMessages(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	msgs, err := store.GetMessages(roomID)
	if err != nil {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	if msgs == nil {
		msgs = []store.Message{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"messages": msgs})
}

// ── WS /chat/ws/:id — customer WebSocket ──────────────────────────────────────

func CustomerWS(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	room, err := store.GetRoom(roomID)
	if err != nil || room.Status == "closed" {
		http.Error(w, "room not found", http.StatusNotFound)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &hub.Client{Conn: conn, Send: make(chan []byte, 64), RoomID: roomID}
	hub.Chat.JoinRoom(roomID, client)
	defer func() {
		hub.Chat.LeaveRoom(roomID, client)
		conn.Close()
	}()

	go client.Pump()

	// Send existing messages (welcome, etc.)
	if history, err := store.GetMessages(roomID); err == nil && len(history) > 0 {
		client.Write(map[string]any{"type": "history", "messages": history})
	}

	// Send queue position while waiting
	if room.Status == "queued" {
		queued, _ := store.ListQueued()
		for i, q := range queued {
			if q.ID == roomID {
				client.Write(map[string]any{"type": "queue_position", "position": i + 1})
				break
			}
		}
	}

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var msg wsMsg
		if err := json.Unmarshal(raw, &msg); err != nil || msg.Content == "" {
			continue
		}

		m := &store.Message{
			ID:         uuid.NewString(),
			RoomID:     roomID,
			SenderType: "user",
			SenderName: room.UserName,
			Content:    msg.Content,
			CreatedAt:  time.Now(),
		}
		_ = store.SaveMessage(m)
		payload := map[string]any{"type": "message", "room_id": roomID, "message": m}
		hub.Chat.BroadcastToRoom(roomID, payload)
		// Also notify all agents (even before they join the room)
		hub.Chat.BroadcastToAgents(payload)
	}
}

// ── WS /chat/admin/ws — agent WebSocket ──────────────────────────────────────

func deliverAgentMessage(roomID string, user *middleware.RailsUser, content string) (*store.Message, error) {
	_ = store.AssignAgent(roomID, user.ID, user.Name)
	m := &store.Message{
		ID:         uuid.NewString(),
		RoomID:     roomID,
		SenderType: "agent",
		SenderName: user.Name,
		Content:    content,
		CreatedAt:  time.Now(),
	}
	if err := store.SaveMessage(m); err != nil {
		return nil, err
	}
	payload := map[string]any{"type": "message", "room_id": roomID, "message": m}
	hub.Chat.BroadcastToRoom(roomID, payload)
	hub.Chat.BroadcastToAgents(payload)
	return m, nil
}

func joinAgentRoom(roomID string, user *middleware.RailsUser) (*store.Room, []store.Message, error) {
	if err := store.AssignAgent(roomID, user.ID, user.Name); err != nil {
		return nil, nil, err
	}
	room, err := store.GetRoom(roomID)
	if err != nil {
		return nil, nil, err
	}
	sysMsg := &store.Message{
		ID:         uuid.NewString(),
		RoomID:     roomID,
		SenderType: "system",
		SenderName: "Kidelio",
		Content:    user.Name + " a rejoint la conversation.",
		CreatedAt:  time.Now(),
	}
	_ = store.SaveMessage(sysMsg)
	joinPayload := map[string]any{"type": "message", "room_id": roomID, "message": sysMsg}
	hub.Chat.BroadcastToRoom(roomID, joinPayload)
	// Tell customer they're no longer waiting
	hub.Chat.BroadcastToRoom(roomID, map[string]any{"type": "agent_joined"})
	hub.Chat.BroadcastToAgents(map[string]any{"type": "queue_remove", "room_id": roomID})
	refreshQueue()
	refreshQueuePositions()
	msgs, _ := store.GetMessages(roomID)
	if msgs == nil {
		msgs = []store.Message{}
	}
	return room, msgs, nil
}

func closeChatRoom(roomID string) error {
	_ = store.CloseRoom(roomID)
	sysMsg := &store.Message{
		ID:         uuid.NewString(),
		RoomID:     roomID,
		SenderType: "system",
		SenderName: "Kidelio",
		Content:    "La conversation a été clôturée. Merci de nous avoir contactés !",
		CreatedAt:  time.Now(),
	}
	_ = store.SaveMessage(sysMsg)
	closedPayload := map[string]any{"type": "room_closed", "room_id": roomID, "message": sysMsg}
	hub.Chat.BroadcastToRoom(roomID, closedPayload)
	hub.Chat.BroadcastToAgents(closedPayload)
	hub.Chat.BroadcastToAgents(map[string]any{"type": "queue_remove", "room_id": roomID})
	refreshQueue()
	refreshQueuePositions()
	return nil
}

// POST /chat/admin/rooms/{id}/join
func AdminJoinRoom(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.StaffFromRequest(w, r)
	if !ok {
		return
	}
	roomID := r.PathValue("id")
	room, msgs, err := joinAgentRoom(roomID, user)
	if err != nil {
		http.Error(w, `{"error":"join failed"}`, http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"room": room, "messages": msgs})
}

// POST /chat/admin/rooms/{id}/messages
func AdminSendMessage(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.StaffFromRequest(w, r)
	if !ok {
		return
	}
	roomID := r.PathValue("id")
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Content == "" {
		http.Error(w, `{"error":"content required"}`, http.StatusBadRequest)
		return
	}
	m, err := deliverAgentMessage(roomID, user, body.Content)
	if err != nil {
		http.Error(w, `{"error":"send failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"message": m})
}

// POST /chat/admin/rooms/{id}/close
func AdminCloseRoom(w http.ResponseWriter, r *http.Request) {
	if _, ok := middleware.StaffFromRequest(w, r); !ok {
		return
	}
	roomID := r.PathValue("id")
	if err := closeChatRoom(roomID); err != nil {
		http.Error(w, `{"error":"close failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

func AgentWS(w http.ResponseWriter, r *http.Request) {
	user, err := middleware.ValidateSession(r)
	if err != nil || !middleware.IsStaff(user) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	agent := &hub.Client{Conn: conn, Send: make(chan []byte, 128)}
	hub.Chat.RegisterAgent(agent)
	defer func() {
		hub.Chat.UnregisterAgent(agent)
		conn.Close()
	}()

	go agent.Pump()

	// Send current queue on connect
	queued, _ := store.ListQueued()
	if queued == nil {
		queued = []store.Room{}
	}
	agent.Write(map[string]any{"type": "queue_snapshot", "rooms": queued})

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var msg wsMsg
		if err := json.Unmarshal(raw, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "join_room":
			if msg.RoomID == "" {
				continue
			}
			if agent.RoomID != "" && agent.RoomID != msg.RoomID {
				hub.Chat.LeaveRoom(agent.RoomID, agent)
			}
			room, msgs, err := joinAgentRoom(msg.RoomID, user)
			if err != nil {
				log.Printf("join_room: %v", err)
				continue
			}
			hub.Chat.JoinRoom(msg.RoomID, agent)
			agent.RoomID = msg.RoomID
			agent.Write(map[string]any{"type": "room_history", "room": room, "messages": msgs})

		case "message":
			roomID := agent.RoomID
			if roomID == "" {
				roomID = msg.RoomID
			}
			if msg.Content == "" || roomID == "" {
				continue
			}
			if agent.RoomID == "" {
				hub.Chat.JoinRoom(roomID, agent)
				agent.RoomID = roomID
			}
			m, err := deliverAgentMessage(roomID, user, msg.Content)
			if err != nil {
				log.Printf("agent message: %v", err)
			} else {
				agent.Write(map[string]any{"type": "message", "room_id": roomID, "message": m})
			}

		case "close_room":
			closedID := agent.RoomID
			if closedID == "" {
				closedID = msg.RoomID
			}
			if closedID == "" {
				continue
			}
			_ = closeChatRoom(closedID)
			hub.Chat.LeaveRoom(closedID, agent)
			agent.RoomID = ""
		}
	}
}

// ── GET /chat/admin/queue ──────────────────────────────────────────────────────

func GetQueue(w http.ResponseWriter, r *http.Request) {
	rooms, err := store.ListQueued()
	if err != nil {
		log.Printf("GetQueue: %v", err)
	}
	if rooms == nil {
		rooms = []store.Room{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"rooms": rooms})
}

func refreshQueue() {
	rooms, _ := store.ListQueued()
	if rooms == nil {
		rooms = []store.Room{}
	}
	hub.Chat.BroadcastToAgents(map[string]any{"type": "queue_snapshot", "rooms": rooms})
}

func refreshQueuePositions() {
	queued, _ := store.ListQueued()
	for i, q := range queued {
		hub.Chat.BroadcastToRoom(q.ID, map[string]any{"type": "queue_position", "position": i + 1})
	}
}
