// auth.go — validates Rails session cookies by proxying /api/v1/auth/me
package middleware

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type RailsUser struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

func railsURL() string {
	u := os.Getenv("RAILS_URL")
	if u == "" {
		u = "http://localhost:7675"
	}
	return u
}

func parseRole(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var s string
	if json.Unmarshal(raw, &s) == nil {
		return s
	}
	var n int
	if json.Unmarshal(raw, &n) == nil {
		switch n {
		case 2:
			return "admin"
		case 1:
			return "employee"
		default:
			return "client"
		}
	}
	return ""
}

func IsStaff(user *RailsUser) bool {
	return user != nil && (user.Role == "admin" || user.Role == "employee")
}

// ValidateSession forwards the incoming Cookie header to Rails and returns the
// authenticated user, or nil + error if not authenticated.
func ValidateSession(r *http.Request) (*RailsUser, error) {
	req, _ := http.NewRequest("GET", railsURL()+"/api/v1/auth/me", nil)
	req.Header.Set("Cookie", r.Header.Get("Cookie"))
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Forwarded-For", r.RemoteAddr)
	req.Header.Set("X-Forwarded-Proto", "https")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("rails unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("not authenticated")
	}

	body, _ := io.ReadAll(resp.Body)
	var payload struct {
		User *struct {
			ID    int64           `json:"id"`
			Name  string          `json:"name"`
			Email string          `json:"email"`
			Role  json.RawMessage `json:"role"`
		} `json:"user"`
	}
	if err := json.Unmarshal(body, &payload); err != nil || payload.User == nil {
		return nil, fmt.Errorf("not authenticated")
	}
	return &RailsUser{
		ID:    payload.User.ID,
		Name:  payload.User.Name,
		Email: payload.User.Email,
		Role:  parseRole(payload.User.Role),
	}, nil
}

// RequireStaff is an HTTP middleware that returns 401 if the user is not staff.
func RequireStaff(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := ValidateSession(r)
		if err != nil || !IsStaff(user) {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

// StaffFromRequest returns the authenticated staff user or writes 401.
func StaffFromRequest(w http.ResponseWriter, r *http.Request) (*RailsUser, bool) {
	user, err := ValidateSession(r)
	if err != nil || !IsStaff(user) {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return nil, false
	}
	return user, true
}
