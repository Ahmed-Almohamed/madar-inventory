CREATE TABLE client_directory (
 id INTEGER PRIMARY KEY,
 request_id TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('rental','accessories','wholesale')),
 city TEXT NOT NULL DEFAULT '',
 phone TEXT NOT NULL DEFAULT '',
 details TEXT NOT NULL DEFAULT '',
 price_cents INTEGER CHECK(price_cents>=0),
 quantity INTEGER CHECK(quantity>=0),
 notes TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_client_directory_category ON client_directory(category,name);
