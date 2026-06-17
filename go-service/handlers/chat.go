package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
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

// Shown to customers — never expose staff personal names in chat.
const agentDisplayName = "Support"

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

	room := &store.Room{
		ID:        uuid.NewString(),
		UserName:  body.Name,
		UserEmail: body.Email,
		Status:    "queued",
	}
	// Rails forwards logged-in customer on headers (avoids Go→Rails callback deadlock).
	if id, err := strconv.ParseInt(r.Header.Get("X-Kidelio-Customer-Id"), 10, 64); err == nil && id > 0 {
		room.UserID = &id
		if n := r.Header.Get("X-Kidelio-Customer-Name"); n != "" {
			room.UserName = n
		}
		if e := r.Header.Get("X-Kidelio-Customer-Email"); e != "" {
			room.UserEmail = e
		}
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

// deliverCustomerMessage saves a user message and broadcasts it to the room + agents.
func deliverCustomerMessage(roomID, content string) (*store.Message, error) {
	room, err := store.GetRoom(roomID)
	if err != nil || room.Status == "closed" {
		return nil, err
	}
	m := &store.Message{
		ID:         uuid.NewString(),
		RoomID:     roomID,
		SenderType: "user",
		SenderName: room.UserName,
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

// ── GET /chat/rooms/:id/messages ──────────────────────────────────────────────

func GetMessages(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	room, err := store.GetRoom(roomID)
	if err != nil || room == nil {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	msgs, err := store.GetMessages(roomID)
	if err != nil {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	if msgs == nil {
		msgs = []store.Message{}
	}
	payload := map[string]any{
		"messages": msgs,
		"room": map[string]any{
			"id":     room.ID,
			"status": room.Status,
		},
	}
	if room.Status == "queued" {
		if queued, _ := store.ListQueued(); queued != nil {
			for i, q := range queued {
				if q.ID == roomID {
					payload["queue_position"] = i + 1
					break
				}
			}
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(payload)
}

// ── POST /chat/rooms/:id/messages — customer sends via HTTP (WS fallback) ───

func CustomerSendMessage(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Content == "" {
		http.Error(w, `{"error":"content required"}`, http.StatusBadRequest)
		return
	}
	m, err := deliverCustomerMessage(roomID, body.Content)
	if err != nil {
		http.Error(w, `{"error":"room not found"}`, http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"message": m})
}

// ── WS /chat/ws/:id — customer WebSocket ──────────────────────────────────────

func CustomerWS(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	room, err := store.GetRoom(roomID)
	if err != nil || room == nil {
		http.Error(w, "room not found", http.StatusNotFound)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &hub.Client{Conn: conn, Send: make(chan []byte, 64), RoomID: roomID}
	go client.Pump()

	history, _ := store.GetMessages(roomID)
	if history == nil {
		history = []store.Message{}
	}
	if len(history) > 0 {
		client.Write(map[string]any{"type": "history", "messages": history})
	}

	if room.Status == "closed" {
		payload := map[string]any{"type": "room_closed", "room_id": roomID}
		for i := len(history) - 1; i >= 0; i-- {
			if history[i].SenderType == "system" {
				payload["message"] = history[i]
				break
			}
		}
		client.Write(payload)
		conn.Close()
		return
	}

	hub.Chat.JoinRoom(roomID, client)
	defer func() {
		hub.Chat.LeaveRoom(roomID, client)
		conn.Close()
	}()

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
		if _, err := deliverCustomerMessage(roomID, msg.Content); err != nil {
			client.Write(map[string]any{"type": "room_closed", "room_id": roomID})
			break
		}
	}
}

// ── WS /chat/admin/ws — agent WebSocket ──────────────────────────────────────

func deliverAgentMessage(roomID string, user *middleware.RailsUser, content string) (*store.Message, error) {
	_ = store.AssignAgent(roomID, user.ID, agentDisplayName)
	m := &store.Message{
		ID:         uuid.NewString(),
		RoomID:     roomID,
		SenderType: "agent",
		SenderName: agentDisplayName,
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
	if err := store.AssignAgent(roomID, user.ID, agentDisplayName); err != nil {
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
		Content:    agentDisplayName + " a rejoint la conversation.",
		CreatedAt:  time.Now(),
	}
	_ = store.SaveMessage(sysMsg)
	joinPayload := map[string]any{"type": "message", "room_id": roomID, "message": sysMsg}
	hub.Chat.BroadcastToRoom(roomID, joinPayload)
	// Tell customer they're no longer waiting
	hub.Chat.BroadcastToRoom(roomID, map[string]any{"type": "agent_joined"})
	hub.Chat.BroadcastToAgents(map[string]any{"type": "queue_remove", "room_id": roomID})
	hub.Chat.BroadcastToAgents(map[string]any{"type": "active_add", "room": room})
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
	hub.Chat.BroadcastToAgents(map[string]any{"type": "active_remove", "room_id": roomID})
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

	// Send current inbox on connect
	queued, _ := store.ListQueued()
	if queued == nil {
		queued = []store.Room{}
	}
	active, _ := store.ListActiveForAgent(user.ID)
	if active == nil {
		active = []store.Room{}
	}
	agent.Write(map[string]any{"type": "inbox_snapshot", "queued": queued, "active": active})

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

// ── GET /chat/admin/archives ─────────────────────────────────────────────────

func GetArchives(w http.ResponseWriter, r *http.Request) {
	limit, offset := 50, 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if n, err := strconv.Atoi(o); err == nil && n >= 0 {
			offset = n
		}
	}
	query := r.URL.Query().Get("q")

	rooms, err := store.ListClosedRooms(limit, offset, query)
	if err != nil {
		log.Printf("GetArchives: %v", err)
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	if rooms == nil {
		rooms = []store.ArchivedRoom{}
	}
	total, _ := store.CountClosedRooms(query)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"rooms":  rooms,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// DELETE /chat/admin/rooms/{id} — permanently delete archived conversation
func AdminDeleteRoom(w http.ResponseWriter, r *http.Request) {
	if _, ok := middleware.StaffFromRequest(w, r); !ok {
		return
	}
	roomID := r.PathValue("id")
	room, err := store.GetRoom(roomID)
	if err != nil || room == nil || room.Status != "closed" {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	if err := store.DeleteClosedRoom(roomID); err != nil {
		log.Printf("AdminDeleteRoom: %v", err)
		http.Error(w, `{"error":"delete failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

// ── GET /chat/admin/rooms/{id} — read-only archived conversation ─────────────

func GetAdminRoom(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	room, err := store.GetRoom(roomID)
	if err != nil || room == nil || room.Status != "closed" {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	msgs, err := store.GetMessages(roomID)
	if err != nil {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	if msgs == nil {
		msgs = []store.Message{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"room": room, "messages": msgs})
}

// ── GET /chat/admin/queue ──────────────────────────────────────────────────────

func GetQueue(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.StaffFromRequest(w, r)
	if !ok {
		return
	}
	queued, err := store.ListQueued()
	if err != nil {
		log.Printf("GetQueue: %v", err)
	}
	if queued == nil {
		queued = []store.Room{}
	}
	active, err := store.ListActiveForAgent(user.ID)
	if err != nil {
		log.Printf("GetQueue active: %v", err)
	}
	if active == nil {
		active = []store.Room{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"queued": queued, "active": active})
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
