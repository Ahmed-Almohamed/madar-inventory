CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','employee')),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE auth_limits(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE activity(id INTEGER PRIMARY KEY,actor_id INTEGER NOT NULL REFERENCES users(id),path TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE INDEX activity_created ON activity(id DESC);
CREATE TABLE expenses(id INTEGER PRIMARY KEY,request_id TEXT NOT NULL UNIQUE,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),currency TEXT NOT NULL CHECK(currency IN ('USD','SYP')),details TEXT NOT NULL,paid_on TEXT NOT NULL,created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL DEFAULT(datetime('now')));
