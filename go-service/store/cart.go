package store

import "time"

type CartEvent struct {
	ID          string    `json:"id"`
	UserID      *int64    `json:"user_id"`
	SessionID   string    `json:"session_id"`
	Action      string    `json:"action"`
	ProductID   *int64    `json:"product_id"`
	ProductName string    `json:"product_name"`
	Quantity    int       `json:"quantity"`
	Price       float64   `json:"price"`
	ColorID     *int64    `json:"color_id"`
	ColorLabel  string    `json:"color_label"`
	SizeLabel   string    `json:"size_label"`
	CreatedAt   time.Time `json:"created_at"`
}

func SaveCartEvent(e *CartEvent) error {
	_, err := DB.Exec(
		`INSERT INTO cart_events (id, user_id, session_id, action, product_id, product_name, quantity, price, color_id, color_label, size_label) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
		e.ID, e.UserID, e.SessionID, e.Action, e.ProductID, e.ProductName, e.Quantity, e.Price, e.ColorID, e.ColorLabel, e.SizeLabel,
	)
	return err
}

func RecentCartEvents(limit int) ([]CartEvent, error) {
	rows, err := ReadDB.Query(
		`SELECT id, user_id, session_id, action, product_id, product_name, quantity, price, color_id, color_label, size_label, created_at FROM cart_events ORDER BY created_at DESC LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var events []CartEvent
	for rows.Next() {
		var e CartEvent
		if err := rows.Scan(&e.ID, &e.UserID, &e.SessionID, &e.Action, &e.ProductID, &e.ProductName, &e.Quantity, &e.Price, &e.ColorID, &e.ColorLabel, &e.SizeLabel, &e.CreatedAt); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}
