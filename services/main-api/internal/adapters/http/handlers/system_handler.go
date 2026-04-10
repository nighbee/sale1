package handlers

import (
	"context"
	"fmt"

	"github.com/go-redis/redis/v8"
	"github.com/gofiber/fiber/v2"
)

type SystemHandler struct {
	rdb *redis.Client
}

func NewSystemHandler(rdb *redis.Client) *SystemHandler {
	return &SystemHandler{rdb: rdb}
}

// GetStatus godoc
// @Summary Get system status
// @Description Get real-time queue lengths and overall status
// @Tags admin
// @Accept json
// @Produce json
// @Success 200 {object} fiber.Map
// @Security BearerAuth
// @Router /admin/system/status [get]
func (h *SystemHandler) GetStatus(c *fiber.Ctx) error {
	ctx := c.Context()
	queues := []string{"stt_queue", "analysis_queue", "notify_queue", "integration_sync"}
	metrics := make(map[string]int)

	for _, q := range queues {
		// Example for BullMQ/Redis: LLEN for simple lists, or HGET for more complex structures
		// Here we assume simple list lengths for monitoring purposes
		val, _ := h.rdb.LLen(ctx, q).Result()
		metrics[q] = int(val)
	}

	return c.JSON(fiber.Map{
		"status": "healthy",
		"queues": metrics,
	})
}

// ListRedisKeys godoc
// @Summary List Redis keys
// @Description List keys in Redis with optional pattern
// @Tags admin
// @Accept json
// @Produce json
// @Param pattern query string false "Key pattern (e.g. user:*)"
// @Success 200 {object} fiber.Map
// @Security BearerAuth
// @Router /admin/system/redis [get]
func (h *SystemHandler) ListRedisKeys(c *fiber.Ctx) error {
	pattern := c.Query("pattern", "*")
	ctx := c.Context()

	var allKeys []string
	iter := h.rdb.Scan(ctx, 0, pattern, 1000).Iterator()
	for iter.Next(ctx) {
		allKeys = append(allKeys, iter.Val())
		if len(allKeys) >= 1000 { // Limit to 1000 keys for safety
			break
		}
	}

	if err := iter.Err(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	result := []fiber.Map{}
	for _, k := range allKeys {
		t, _ := h.rdb.Type(ctx, k).Result()
		result = append(result, fiber.Map{
			"key":  k,
			"type": t,
		})
	}

	return c.JSON(fiber.Map{"keys": result})
}

// GetRedisValue godoc
// @Summary Get Redis key value
// @Description Get the value of a specific Redis key
// @Tags admin
// @Accept json
// @Produce json
// @Param key query string true "Redis key"
// @Success 200 {object} fiber.Map
// @Security BearerAuth
// @Router /admin/system/redis/value [get]
func (h *SystemHandler) GetRedisValue(c *fiber.Ctx) error {
	key := c.Query("key")
	if key == "" {
		return c.Status(400).JSON(fiber.Map{"error": "key is required"})
	}

	ctx := c.Context()
	t, _ := h.rdb.Type(ctx, key).Result()
	var val interface{}
	var err error

	switch t {
	case "string":
		val, err = h.rdb.Get(ctx, key).Result()
	case "list":
		val, err = h.rdb.LRange(ctx, key, 0, -1).Result()
	case "hash":
		val, err = h.rdb.HGetAll(ctx, key).Result()
	case "set":
		val, err = h.rdb.SMembers(ctx, key).Result()
	case "zset":
		val, err = h.rdb.ZRange(ctx, key, 0, -1).Result()
	default:
		return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("unsupported type: %s", t)})
	}

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"key": key, "type": t, "value": val})
}

// UpdateRedisValue godoc
// @Summary Update Redis key value
// @Description Update the value of a specific Redis key
// @Tags admin
// @Accept json
// @Produce json
// @Param request body fiber.Map true "Key and Value"
// @Success 200 {object} fiber.Map
// @Security BearerAuth
// @Router /admin/system/redis [put]
func (h *SystemHandler) UpdateRedisValue(c *fiber.Ctx) error {
	var req struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	err := h.rdb.Set(context.Background(), req.Key, req.Value, 0).Err()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"status": "ok"})
}

// DeleteRedisKey godoc
// @Summary Delete Redis key
// @Description Delete a specific Redis key
// @Tags admin
// @Accept json
// @Produce json
// @Param key query string true "Redis key"
// @Success 200 {object} fiber.Map
// @Security BearerAuth
// @Router /admin/system/redis [delete]
func (h *SystemHandler) DeleteRedisKey(c *fiber.Ctx) error {
	key := c.Query("key")
	if key == "" {
		return c.Status(400).JSON(fiber.Map{"error": "key is required"})
	}

	err := h.rdb.Del(c.Context(), key).Err()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"status": "ok"})
}
