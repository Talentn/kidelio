package handlers

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/kidelio/go-service/middleware"
)

var notifyClient = &http.Client{Timeout: 3 * time.Second}

// notifyRails fires a best-effort event to the Rails API, which fans it out as
// Web Push notifications to subscribed staff devices. Runs in a goroutine and
// never blocks or fails the chat flow.
func notifyRails(event, roomID, name, preview string) {
	secret := middleware.InternalSecret()
	if secret == "" {
		return
	}
	go func() {
		payload, _ := json.Marshal(map[string]string{
			"event":   event,
			"room_id": roomID,
			"name":    name,
			"preview": preview,
		})
		req, err := http.NewRequest("POST", middleware.RailsURL()+"/api/v1/internal/events", bytes.NewReader(payload))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Kidelio-Internal", secret)
		resp, err := notifyClient.Do(req)
		if err != nil {
			log.Printf("notifyRails %s: %v", event, err)
			return
		}
		resp.Body.Close()
	}()
}
