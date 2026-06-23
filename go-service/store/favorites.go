package store

import "time"

type FavoriteEvent struct {
	ID          string    `json:"id"`
	UserID      *int64    `json:"user_id"`
	SessionID   string    `json:"session_id"`
	Action      string    `json:"action"`
	ProductID   *int64    `json:"product_id"`
	ProductName string    `json:"product_name"`
	CreatedAt   time.Time `json:"created_at"`
}

func SaveFavoriteEvent(e *FavoriteEvent) error {
	_, err := DB.Exec(
		`INSERT INTO favorite_events (id, user_id, session_id, action, product_id, product_name) VALUES (?,?,?,?,?,?)`,
		e.ID, e.UserID, e.SessionID, e.Action, e.ProductID, e.ProductName,
	)
	return err
}

func RecentFavoriteEvents(limit int) ([]FavoriteEvent, error) {
	rows, err := ReadDB.Query(
		`SELECT id, user_id, session_id, action, product_id, product_name, created_at FROM favorite_events ORDER BY created_at DESC LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var events []FavoriteEvent
	for rows.Next() {
		var e FavoriteEvent
		if err := rows.Scan(&e.ID, &e.UserID, &e.SessionID, &e.Action, &e.ProductID, &e.ProductName, &e.CreatedAt); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}
