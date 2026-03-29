CREATE TABLE IF NOT EXISTS sessions (
  key         TEXT PRIMARY KEY,
  channel     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  chat_id     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS turns (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT NOT NULL REFERENCES sessions(key),
  role        TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_key, id);
