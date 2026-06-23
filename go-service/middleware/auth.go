// auth.go — validates Rails session cookies by proxying /api/v1/auth/me
package middleware

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)

var railsHTTPClient = &http.Client{Timeout: 3 * time.Second}

// Short-lived cache of session validations keyed by the cookie header. This
// collapses the repeated Go→Rails /auth/me round-trips (one per WS connect /
// admin request) that otherwise pile up and stall when Rails is busy.
const sessionCacheTTL = 15 * time.Second

type cachedSession struct {
	user      *RailsUser
	err       bool
	expiresAt time.Time
}

var (
	sessionCacheMu sync.Mutex
	sessionCache   = make(map[string]cachedSession)
)

func cachedValidation(cookie string) (*RailsUser, bool, bool) {
	if cookie == "" {
		return nil, false, false
	}
	sessionCacheMu.Lock()
	defer sessionCacheMu.Unlock()
	entry, ok := sessionCache[cookie]
	if !ok || time.Now().After(entry.expiresAt) {
		if ok {
			delete(sessionCache, cookie)
		}
		return nil, false, false
	}
	return entry.user, entry.err, true
}

func storeValidation(cookie string, user *RailsUser, failed bool) {
	if cookie == "" {
		return
	}
	sessionCacheMu.Lock()
	defer sessionCacheMu.Unlock()
	if len(sessionCache) > 5000 {
		sessionCache = make(map[string]cachedSession)
	}
	sessionCache[cookie] = cachedSession{
		user:      user,
		err:       failed,
		expiresAt: time.Now().Add(sessionCacheTTL),
	}
}

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

func internalSecret() string {
	if s := os.Getenv("GO_INTERNAL_SECRET"); s != "" {
		return s
	}
	if os.Getenv("GO_ENV") != "production" {
		return "dev-internal"
	}
	return ""
}

// staffFromInternal trusts staff identity forwarded by Rails after session check.
func staffFromInternal(r *http.Request) *RailsUser {
	secret := internalSecret()
	if secret == "" || r.Header.Get("X-Kidelio-Internal") != secret {
		return nil
	}
	id, err := strconv.ParseInt(r.Header.Get("X-Kidelio-User-Id"), 10, 64)
	if err != nil || id == 0 {
		return nil
	}
	role := r.Header.Get("X-Kidelio-User-Role")
	if role != "admin" && role != "employee" {
		return nil
	}
	return &RailsUser{
		ID:    id,
		Name:  r.Header.Get("X-Kidelio-User-Name"),
		Email: "",
		Role:  role,
	}
}

// ValidateSession forwards the incoming Cookie header to Rails and returns the
// authenticated user, or nil + error if not authenticated.
func ValidateSession(r *http.Request) (*RailsUser, error) {
	if user := staffFromInternal(r); user != nil {
		return user, nil
	}

	cookie := r.Header.Get("Cookie")
	if user, failed, ok := cachedValidation(cookie); ok {
		if failed {
			return nil, fmt.Errorf("not authenticated")
		}
		return user, nil
	}

	req, _ := http.NewRequest("GET", railsURL()+"/api/v1/auth/me", nil)
	req.Header.Set("Cookie", cookie)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Forwarded-For", r.RemoteAddr)
	req.Header.Set("X-Forwarded-Proto", "https")

	resp, err := railsHTTPClient.Do(req)
	if err != nil {
		// Don't cache transient transport errors — Rails may just be briefly busy.
		return nil, fmt.Errorf("rails unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		storeValidation(cookie, nil, true)
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
		storeValidation(cookie, nil, true)
		return nil, fmt.Errorf("not authenticated")
	}
	user := &RailsUser{
		ID:    payload.User.ID,
		Name:  payload.User.Name,
		Email: payload.User.Email,
		Role:  parseRole(payload.User.Role),
	}
	storeValidation(cookie, user, false)
	return user, nil
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
