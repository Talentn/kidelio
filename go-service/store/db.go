package store

import (
	"database/sql"
	"log"
	"runtime"

	_ "modernc.org/sqlite"
)

// DB is the write pool: a single connection so writes serialize cleanly and
// never trigger "database is locked" between competing writers.
// ReadDB is a separate multi-connection pool so SELECTs run concurrently and
// are never blocked behind an in-flight write (the main source of request hangs).
var (
	DB     *sql.DB
	ReadDB *sql.DB
)

func Init(path string) {
	// WAL lets readers proceed while a write is in progress; the long busy
	// timeout makes contended writes wait instead of failing.
	dsn := path + "?_journal_mode=WAL&_busy_timeout=10000&_synchronous=NORMAL"

	var err error
	DB, err = sql.Open("sqlite", dsn)
	if err != nil {
		log.Fatalf("store: open write db: %v", err)
	}
	DB.SetMaxOpenConns(1)

	ReadDB, err = sql.Open("sqlite", dsn)
	if err != nil {
		log.Fatalf("store: open read db: %v", err)
	}
	readConns := runtime.NumCPU()
	if readConns < 4 {
		readConns = 4
	}
	ReadDB.SetMaxOpenConns(readConns)

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

	CREATE TABLE IF NOT EXISTS user_events (
		id           TEXT PRIMARY KEY,
		user_id      INTEGER,
		session_id   TEXT NOT NULL,
		event_type   TEXT NOT NULL,
		path         TEXT,
		product_id   INTEGER,
		product_name TEXT,
		metadata     TEXT,
		created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_user_events_time ON user_events(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(event_type, created_at DESC);
	`
	if _, err := DB.Exec(schema); err != nil {
		log.Fatalf("store: migrate: %v", err)
	}

	// Add cart variant columns on existing databases (ignore duplicate column errors).
	for _, stmt := range []string{
		`ALTER TABLE cart_events ADD COLUMN color_id INTEGER`,
		`ALTER TABLE cart_events ADD COLUMN color_label TEXT`,
		`ALTER TABLE cart_events ADD COLUMN size_label TEXT`,
	} {
		_, _ = DB.Exec(stmt)
	}
}
