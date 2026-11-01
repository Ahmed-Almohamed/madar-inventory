CREATE TABLE workspace_resets(request_id TEXT PRIMARY KEY,actor_id INTEGER NOT NULL REFERENCES users(id),completed_at TEXT);
