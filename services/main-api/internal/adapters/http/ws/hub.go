package ws

import (
	"sync"

	"github.com/gofiber/websocket/v2"
)

type Client struct {
	UserID    string
	CompanyID string
	Conn      *websocket.Conn
}

type Hub struct {
	clients    map[*websocket.Conn]*Client
	register   chan *Client
	unregister chan *websocket.Conn
	broadcast  chan Message
	mu         sync.RWMutex
}

type Message struct {
	UserID    string      `json:"user_id,omitempty"`
	CompanyID string      `json:"company_id,omitempty"`
	Type      string      `json:"type"`
	Payload   interface{} `json:"payload"`
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]*Client),
		register:   make(chan *Client),
		unregister: make(chan *websocket.Conn),
		broadcast:  make(chan Message),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.Conn] = client
			h.mu.Unlock()
		case conn := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[conn]; ok {
				delete(h.clients, conn)
				conn.Close()
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			h.mu.RLock()
			for conn, client := range h.clients {
				// Send to specific user if UserID is set
				if message.UserID != "" && client.UserID != message.UserID {
					continue
				}
				// Send to everyone in company if UserID is empty but CompanyID is set
				if message.UserID == "" && message.CompanyID != "" && client.CompanyID != message.CompanyID {
					continue
				}

				err := conn.WriteJSON(message)
				if err != nil {
					conn.Close()
					delete(h.clients, conn)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(conn *websocket.Conn) {
	h.unregister <- conn
}

func (h *Hub) Broadcast(msg Message) {
	h.broadcast <- msg
}
