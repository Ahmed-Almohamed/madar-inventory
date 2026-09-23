-- Preserve all existing inventory and sales.
CREATE TABLE technicians (
 id INTEGER PRIMARY KEY,
 name TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '',
 warehouse_id INTEGER REFERENCES warehouses(id),
 request_id TEXT NOT NULL UNIQUE
);
ALTER TABLE sales ADD COLUMN technician_id INTEGER REFERENCES technicians(id);
ALTER TABLE sales ADD COLUMN installation_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(installation_fee_cents >= 0);
CREATE INDEX idx_sales_technician ON sales(technician_id);
