ALTER TABLE warehouses ADD COLUMN governorate TEXT NOT NULL DEFAULT '';
ALTER TABLE warehouses ADD COLUMN request_id TEXT;
CREATE UNIQUE INDEX idx_warehouses_request ON warehouses(request_id);
CREATE TABLE warehouse_technicians (
 warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
 technician_id INTEGER NOT NULL REFERENCES technicians(id),
 PRIMARY KEY(warehouse_id,technician_id)
);
INSERT INTO warehouse_technicians SELECT warehouse_id,id FROM technicians WHERE warehouse_id IS NOT NULL;
CREATE TRIGGER technician_warehouse_access AFTER INSERT ON technicians WHEN NEW.warehouse_id IS NOT NULL BEGIN
 INSERT OR IGNORE INTO warehouse_technicians VALUES(NEW.warehouse_id,NEW.id);
END;
