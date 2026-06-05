// hub.go — in-memory WebSocket connection registry.
// Two hubs run side by side:
//   - Chat hub: rooms with user clients + agent subscribers
//   - Cart hub: admin subscribers receive every cart event in real-time
package hub

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ── generic client ────────────────────────────────────────────────────────────

type Client struct {
	Conn   *websocket.Conn
	Send   chan []byte
	RoomID string // chat only
	mu     sync.Mutex
}

func (c *Client) Write(msg any) {
	b, err := json.Marshal(msg)
	if err != nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	select {
	case c.Send <- b:
	default:
		// Block briefly rather than drop live chat events
		select {
		case c.Send <- b:
		case <-time.After(2 * time.Second):
		}
	}
}

func (c *Client) Pump() {
	defer c.Conn.Close()
	for msg := range c.Send {
		if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			return
		}
	}
}

// ── Chat hub ──────────────────────────────────────────────────────────────────

type ChatHub struct {
	mu      sync.RWMutex
	rooms   map[string][]*Client // roomID → user + agents
	agents  map[*Client]bool     // all connected agents
}

var Chat = &ChatHub{
	rooms:  make(map[string][]*Client),
	agents: make(map[*Client]bool),
}

func (h *ChatHub) JoinRoom(roomID string, c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.rooms[roomID] = append(h.rooms[roomID], c)
}

func (h *ChatHub) LeaveRoom(roomID string, c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	clients := h.rooms[roomID]
	for i, cc := range clients {
		if cc == c {
			h.rooms[roomID] = append(clients[:i], clients[i+1:]...)
			break
		}
	}
}

func (h *ChatHub) RegisterAgent(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.agents[c] = true
}

func (h *ChatHub) UnregisterAgent(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.agents, c)
}

func (h *ChatHub) BroadcastToRoom(roomID string, msg any) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, c := range h.rooms[roomID] {
		c.Write(msg)
	}
}

// BroadcastToAgents sends a message to all connected admin agents (queue updates etc.)
func (h *ChatHub) BroadcastToAgents(msg any) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.agents {
		c.Write(msg)
	}
}

// ── Cart hub ──────────────────────────────────────────────────────────────────

type CartHub struct {
	mu      sync.RWMutex
	admins  map[*Client]bool
}

var Cart = &CartHub{
	admins: make(map[*Client]bool),
}

func (h *CartHub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.admins[c] = true
}

func (h *CartHub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.admins, c)
}

func (h *CartHub) Broadcast(msg any) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.admins {
		c.Write(msg)
	}
}

// ── Favorites hub ─────────────────────────────────────────────────────────────

type FavoritesHub struct {
	mu     sync.RWMutex
	admins map[*Client]bool
}

var Favorites = &FavoritesHub{
	admins: make(map[*Client]bool),
}

func (h *FavoritesHub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.admins[c] = true
}

func (h *FavoritesHub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.admins, c)
}

func (h *FavoritesHub) Broadcast(msg any) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.admins {
		c.Write(msg)
	}
}
