package store

import (
	"database/sql"
	"log"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func Init(path string) {
	var err error
	DB, err = sql.Open("sqlite", path+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		log.Fatalf("store: open db: %v", err)
	}
	DB.SetMaxOpenConns(1)
	migrate()
}

func migrate() {
	schema := `
	CREATE TABLE IF NOT EXISTS chat_rooms (
		id          TEXT PRIMARY KEY,
		user_id     INTEGER,
		user_name   TEXT NOT NULL,
		user_email  TEXT,
		status      TEXT NOT NULL DEFAULT 'queued', -- queued | active | closed
		agent_id    INTEGER,
		agent_name  TEXT,
		created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS chat_messages (
		id          TEXT PRIMARY KEY,
		room_id     TEXT NOT NULL REFERENCES chat_rooms(id),
		sender_type TEXT NOT NULL, -- 'user' | 'agent' | 'system'
		sender_name TEXT NOT NULL,
		content     TEXT NOT NULL,
		created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_messages_room ON chat_messages(room_id, created_at);

	CREATE TABLE IF NOT EXISTS cart_events (
		id          TEXT PRIMARY KEY,
		user_id     INTEGER,
		session_id  TEXT,
		action      TEXT NOT NULL, -- 'add' | 'remove' | 'update' | 'clear'
		product_id  INTEGER,
		product_name TEXT,
		quantity    INTEGER DEFAULT 1,
		price       REAL,
		created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_cart_events_time ON cart_events(created_at DESC);

	CREATE TABLE IF NOT EXISTS favorite_events (
		id           TEXT PRIMARY KEY,
		user_id      INTEGER,
		session_id   TEXT,
		action       TEXT NOT NULL, -- 'add' | 'remove'
		product_id   INTEGER,
		product_name TEXT,
		created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_favorite_events_time ON favorite_events(created_at DESC);
	`
	if _, err := DB.Exec(schema); err != nil {
		log.Fatalf("store: migrate: %v", err)
	}
}
