package store

import (
	"database/sql"
	"time"
)

type Room struct {
	ID        string    `json:"id"`
	UserID    *int64    `json:"user_id"`
	UserName  string    `json:"user_name"`
	UserEmail string    `json:"user_email"`
	Status    string    `json:"status"`
	AgentID   *int64    `json:"agent_id"`
	AgentName string    `json:"agent_name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Message struct {
	ID         string    `json:"id"`
	RoomID     string    `json:"room_id"`
	SenderType string    `json:"sender_type"`
	SenderName string    `json:"sender_name"`
	Content    string    `json:"content"`
	CreatedAt  time.Time `json:"created_at"`
}

func scanRoom(scanner interface{ Scan(dest ...any) error }) (*Room, error) {
	r := &Room{}
	var userEmail, agentName sql.NullString
	err := scanner.Scan(
		&r.ID, &r.UserID, &r.UserName, &userEmail,
		&r.Status, &r.AgentID, &agentName,
		&r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	r.UserEmail = userEmail.String
	r.AgentName = agentName.String
	return r, nil
}

func CreateRoom(r *Room) error {
	_, err := DB.Exec(
		`INSERT INTO chat_rooms (id, user_id, user_name, user_email, status) VALUES (?,?,?,?,?)`,
		r.ID, r.UserID, r.UserName, r.UserEmail, r.Status,
	)
	return err
}

func GetRoom(id string) (*Room, error) {
	row := DB.QueryRow(
		`SELECT id, user_id, user_name, user_email, status, agent_id, agent_name, created_at, updated_at FROM chat_rooms WHERE id = ?`,
		id,
	)
	return scanRoom(row)
}

func ListQueued() ([]Room, error) {
	rows, err := DB.Query(
		`SELECT id, user_id, user_name, user_email, status, agent_id, agent_name, created_at, updated_at FROM chat_rooms WHERE status = 'queued' ORDER BY created_at`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var rooms []Room
	for rows.Next() {
		r, err := scanRoom(rows)
		if err != nil {
			return nil, err
		}
		rooms = append(rooms, *r)
	}
	return rooms, nil
}

func ListActiveForAgent(agentID int64) ([]Room, error) {
	rows, err := DB.Query(
		`SELECT id, user_id, user_name, user_email, status, agent_id, agent_name, created_at, updated_at FROM chat_rooms WHERE status = 'active' AND agent_id = ? ORDER BY updated_at DESC`,
		agentID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var rooms []Room
	for rows.Next() {
		r, err := scanRoom(rows)
		if err != nil {
			return nil, err
		}
		rooms = append(rooms, *r)
	}
	return rooms, nil
}

func AssignAgent(roomID string, agentID int64, agentName string) error {
	_, err := DB.Exec(
		`UPDATE chat_rooms SET status='active', agent_id=?, agent_name=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
		agentID, agentName, roomID,
	)
	return err
}

func CloseRoom(roomID string) error {
	_, err := DB.Exec(`UPDATE chat_rooms SET status='closed', updated_at=CURRENT_TIMESTAMP WHERE id=?`, roomID)
	return err
}

func DeleteClosedRoom(roomID string) error {
	if _, err := DB.Exec(`DELETE FROM chat_messages WHERE room_id = ?`, roomID); err != nil {
		return err
	}
	_, err := DB.Exec(`DELETE FROM chat_rooms WHERE id = ? AND status = 'closed'`, roomID)
	return err
}

type ArchivedRoom struct {
	Room
	MessageCount int `json:"message_count"`
}

func ListClosedRooms(limit, offset int, query string) ([]ArchivedRoom, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	sqlText := `
		SELECT r.id, r.user_id, r.user_name, r.user_email, r.status, r.agent_id, r.agent_name,
		       r.created_at, r.updated_at,
		       (SELECT COUNT(*) FROM chat_messages m WHERE m.room_id = r.id) AS message_count
		FROM chat_rooms r
		WHERE r.status = 'closed'`
	args := []any{}
	if query != "" {
		sqlText += ` AND (r.user_name LIKE ? OR r.user_email LIKE ? OR r.agent_name LIKE ?)`
		pattern := "%" + query + "%"
		args = append(args, pattern, pattern, pattern)
	}
	sqlText += ` ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`
	args = append(args, limit, offset)

	rows, err := DB.Query(sqlText, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rooms []ArchivedRoom
	for rows.Next() {
		ar := ArchivedRoom{}
		var userEmail, agentName sql.NullString
		err := rows.Scan(
			&ar.ID, &ar.UserID, &ar.UserName, &userEmail,
			&ar.Status, &ar.AgentID, &agentName,
			&ar.CreatedAt, &ar.UpdatedAt, &ar.MessageCount,
		)
		if err != nil {
			return nil, err
		}
		ar.UserEmail = userEmail.String
		ar.AgentName = agentName.String
		rooms = append(rooms, ar)
	}
	return rooms, nil
}

func CountClosedRooms(query string) (int, error) {
	sqlText := `SELECT COUNT(*) FROM chat_rooms WHERE status = 'closed'`
	args := []any{}
	if query != "" {
		sqlText += ` AND (user_name LIKE ? OR user_email LIKE ? OR agent_name LIKE ?)`
		pattern := "%" + query + "%"
		args = append(args, pattern, pattern, pattern)
	}
	var count int
	err := DB.QueryRow(sqlText, args...).Scan(&count)
	return count, err
}

func SaveMessage(m *Message) error {
	_, err := DB.Exec(
		`INSERT INTO chat_messages (id, room_id, sender_type, sender_name, content) VALUES (?,?,?,?,?)`,
		m.ID, m.RoomID, m.SenderType, m.SenderName, m.Content,
	)
	return err
}

func GetMessages(roomID string) ([]Message, error) {
	rows, err := DB.Query(
		`SELECT id, room_id, sender_type, sender_name, content, created_at FROM chat_messages WHERE room_id = ? ORDER BY created_at`,
		roomID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var msgs []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.RoomID, &m.SenderType, &m.SenderName, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, nil
}
