CREATE TABLE products (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, sku TEXT NOT NULL UNIQUE,
 price_cents INTEGER NOT NULL CHECK(price_cents >= 0), low_stock INTEGER NOT NULL DEFAULT 5 CHECK(low_stock >= 0)
);
CREATE TABLE warehouses (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, address TEXT NOT NULL DEFAULT '');
CREATE TABLE stock (
 product_id INTEGER NOT NULL REFERENCES products(id), warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
 quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0), PRIMARY KEY(product_id, warehouse_id)
);
CREATE TABLE sales (
 id INTEGER PRIMARY KEY, request_id TEXT NOT NULL UNIQUE,
 product_id INTEGER NOT NULL REFERENCES products(id), warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
 quantity INTEGER NOT NULL CHECK(quantity > 0), price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
 customer TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL, address TEXT NOT NULL, source TEXT NOT NULL,
 notes TEXT NOT NULL DEFAULT '', sold_on TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
 cancelled_at TEXT
);
CREATE INDEX idx_sales_sold_on ON sales(sold_on);
CREATE TABLE movements (
 id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
 delta INTEGER NOT NULL CHECK(delta != 0), kind TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
 sale_id INTEGER REFERENCES sales(id), request_id TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_movements_created_at ON movements(created_at);
CREATE TABLE login_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TRIGGER sale_stock_check BEFORE INSERT ON sales BEGIN
 SELECT CASE WHEN COALESCE((SELECT quantity FROM stock WHERE product_id=NEW.product_id AND warehouse_id=NEW.warehouse_id),0)<NEW.quantity
 THEN RAISE(ABORT,'INSUFFICIENT_STOCK') END;
END;
CREATE TRIGGER sale_deduct AFTER INSERT ON sales BEGIN
 UPDATE stock SET quantity=quantity-NEW.quantity WHERE product_id=NEW.product_id AND warehouse_id=NEW.warehouse_id;
 INSERT INTO movements(product_id,warehouse_id,delta,kind,sale_id) VALUES(NEW.product_id,NEW.warehouse_id,-NEW.quantity,'sale',NEW.id);
END;
CREATE TRIGGER sale_restore AFTER UPDATE OF cancelled_at ON sales WHEN OLD.cancelled_at IS NULL AND NEW.cancelled_at IS NOT NULL BEGIN
 UPDATE stock SET quantity=quantity+NEW.quantity WHERE product_id=NEW.product_id AND warehouse_id=NEW.warehouse_id;
 INSERT INTO movements(product_id,warehouse_id,delta,kind,sale_id) VALUES(NEW.product_id,NEW.warehouse_id,NEW.quantity,'return',NEW.id);
END;
CREATE TRIGGER movement_check BEFORE INSERT ON movements WHEN NEW.kind='adjustment' BEGIN
 SELECT CASE WHEN COALESCE((SELECT quantity FROM stock WHERE product_id=NEW.product_id AND warehouse_id=NEW.warehouse_id),0)+NEW.delta<0
 THEN RAISE(ABORT,'INSUFFICIENT_STOCK') END;
END;
CREATE TRIGGER movement_apply AFTER INSERT ON movements WHEN NEW.kind='adjustment' BEGIN
 UPDATE stock SET quantity=quantity+NEW.delta WHERE product_id=NEW.product_id AND warehouse_id=NEW.warehouse_id;
 INSERT INTO stock(product_id,warehouse_id,quantity) SELECT NEW.product_id,NEW.warehouse_id,NEW.delta
 WHERE NOT EXISTS(SELECT 1 FROM stock WHERE product_id=NEW.product_id AND warehouse_id=NEW.warehouse_id);
END;
