package middleware

import (
	"net/http"
	"os"
	"strings"
)

var allowedOrigins []string

func init() {
	loadAllowedOrigins()
}

func loadAllowedOrigins() {
	raw := os.Getenv("ALLOWED_ORIGINS")
	if raw == "" {
		if site := os.Getenv("SITE_URL"); site != "" {
			raw = site
		}
	}
	if raw == "" {
		return
	}
	for _, part := range strings.Split(raw, ",") {
		if o := strings.TrimSpace(part); o != "" {
			allowedOrigins = append(allowedOrigins, o)
		}
	}
}

func isProduction() bool {
	return os.Getenv("GO_ENV") == "production"
}

// AllowedOrigin validates browser Origin headers (CORS + WebSocket).
// Empty Origin is allowed (same-origin requests, curl, server-to-server).
func AllowedOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	if len(allowedOrigins) == 0 {
		return !isProduction()
	}
	for _, o := range allowedOrigins {
		if o == origin {
			return true
		}
	}
	return false
}
