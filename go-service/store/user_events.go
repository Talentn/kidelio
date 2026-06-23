package store

import (
	"database/sql"
	"time"
)

type UserEvent struct {
	ID          string    `json:"id"`
	UserID      *int64    `json:"user_id"`
	SessionID   string    `json:"session_id"`
	EventType   string    `json:"event_type"`
	Path        string    `json:"path"`
	ProductID   *int64    `json:"product_id"`
	ProductName string    `json:"product_name"`
	Metadata    string    `json:"metadata"`
	CreatedAt   time.Time `json:"created_at"`
}

func SaveUserEvent(e *UserEvent) error {
	_, err := DB.Exec(
		`INSERT INTO user_events (id, user_id, session_id, event_type, path, product_id, product_name, metadata) VALUES (?,?,?,?,?,?,?,?)`,
		e.ID, e.UserID, e.SessionID, e.EventType, e.Path, e.ProductID, e.ProductName, e.Metadata,
	)
	return err
}

func RecentUserEvents(limit int, eventType string) ([]UserEvent, error) {
	var rows *sql.Rows
	var err error
	if eventType != "" {
		rows, err = ReadDB.Query(
			`SELECT id, user_id, session_id, event_type, path, product_id, product_name, metadata, created_at FROM user_events WHERE event_type = ? ORDER BY created_at DESC LIMIT ?`,
			eventType, limit,
		)
	} else {
		rows, err = ReadDB.Query(
			`SELECT id, user_id, session_id, event_type, path, product_id, product_name, metadata, created_at FROM user_events ORDER BY created_at DESC LIMIT ?`,
			limit,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var events []UserEvent
	for rows.Next() {
		var e UserEvent
		if err := rows.Scan(&e.ID, &e.UserID, &e.SessionID, &e.EventType, &e.Path, &e.ProductID, &e.ProductName, &e.Metadata, &e.CreatedAt); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}
