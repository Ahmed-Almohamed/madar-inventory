-- Work assignments never imply shared stock. Preserve all existing balances.
ALTER TABLE warehouses ADD COLUMN custody_owner_id INTEGER REFERENCES technicians(id);
CREATE UNIQUE INDEX warehouses_custody_owner ON warehouses(custody_owner_id);
ALTER TABLE technicians ADD COLUMN custody_warehouse_id INTEGER REFERENCES warehouses(id);
ALTER TABLE technicians ADD COLUMN stock_warehouse_id INTEGER REFERENCES warehouses(id);
INSERT INTO warehouses(name,address,governorate,request_id,custody_owner_id)
 SELECT 'عهدة · ' || name || ' · ' || id,'','', 'custody-' || request_id,id FROM technicians;
UPDATE technicians SET custody_warehouse_id=(SELECT id FROM warehouses WHERE custody_owner_id=technicians.id);
CREATE TRIGGER technician_create_custody AFTER INSERT ON technicians BEGIN
 INSERT INTO warehouses(name,address,governorate,request_id,custody_owner_id) VALUES('عهدة · ' || NEW.name || ' · ' || NEW.id,'','','custody-' || NEW.request_id,NEW.id);
 UPDATE technicians SET custody_warehouse_id=(SELECT id FROM warehouses WHERE custody_owner_id=NEW.id) WHERE id=NEW.id;
END;
CREATE TABLE stock_transfers (
 request_id TEXT PRIMARY KEY,
 product_id INTEGER NOT NULL REFERENCES products(id),
 from_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
 to_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
 quantity INTEGER NOT NULL CHECK(quantity>0),
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 CHECK(from_warehouse_id<>to_warehouse_id)
);
CREATE TRIGGER stock_transfer_apply AFTER INSERT ON stock_transfers BEGIN
 INSERT INTO movements(product_id,warehouse_id,delta,kind,note,request_id)
 VALUES(NEW.product_id,NEW.from_warehouse_id,-NEW.quantity,'adjustment','Transfer to #' || NEW.to_warehouse_id,NEW.request_id || '-out');
 INSERT INTO movements(product_id,warehouse_id,delta,kind,note,request_id)
 VALUES(NEW.product_id,NEW.to_warehouse_id,NEW.quantity,'adjustment','Transfer from #' || NEW.from_warehouse_id,NEW.request_id || '-in');
END;
