CREATE TABLE stock_history (
 id INTEGER PRIMARY KEY,
 product_id INTEGER NOT NULL REFERENCES products(id),
 warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
 old_quantity INTEGER NOT NULL,
 new_quantity INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_stock_history_warehouse ON stock_history(warehouse_id,id);
CREATE TRIGGER stock_history_update AFTER UPDATE OF quantity ON stock WHEN OLD.quantity<>NEW.quantity BEGIN
 INSERT INTO stock_history(product_id,warehouse_id,old_quantity,new_quantity) VALUES(NEW.product_id,NEW.warehouse_id,OLD.quantity,NEW.quantity);
END;
CREATE TRIGGER stock_history_insert AFTER INSERT ON stock BEGIN
 INSERT INTO stock_history(product_id,warehouse_id,old_quantity,new_quantity) VALUES(NEW.product_id,NEW.warehouse_id,0,NEW.quantity);
END;
