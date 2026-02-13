package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/salesai/main-api/internal/adapters/http/ws"
)

type WSHandler struct {
	hub *ws.Hub
}

func NewWSHandler(hub *ws.Hub) *WSHandler {
	return &WSHandler{hub: hub}
}

func (h *WSHandler) Handle(c *websocket.Conn) {
	userID := c.Locals("user_id").(string)
	companyID := c.Locals("company_id").(string)

	client := &ws.Client{
		UserID:    userID,
		CompanyID: companyID,
		Conn:      c,
	}

	h.hub.Register(client)

	defer func() {
		h.hub.Unregister(c)
	}()

	for {
		_, _, err := c.ReadMessage()
		if err != nil {
			break
		}
		// We don't expect messages from client for now
	}
}

func WSUpgrade(c *fiber.Ctx) error {
	if websocket.IsWebSocketUpgrade(c) {
		return c.Next()
	}
	return fiber.ErrUpgradeRequired
}
