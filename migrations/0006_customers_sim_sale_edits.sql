ALTER TABLE sales ADD COLUMN sim_code TEXT NOT NULL DEFAULT '';
ALTER TABLE sales ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX idx_active_sim_code ON sales(sim_code COLLATE NOCASE) WHERE sim_code<>'' AND cancelled_at IS NULL;
CREATE INDEX idx_sales_phone ON sales(phone);

CREATE TRIGGER sale_edit_check BEFORE UPDATE OF product_id,warehouse_id,quantity ON sales WHEN OLD.cancelled_at IS NULL AND NEW.cancelled_at IS NULL
 AND (OLD.product_id<>NEW.product_id OR OLD.warehouse_id<>NEW.warehouse_id OR OLD.quantity<>NEW.quantity) BEGIN
 SELECT RAISE(ABORT,'INSUFFICIENT_STOCK') WHERE COALESCE((SELECT quantity FROM stock WHERE product_id=NEW.product_id AND warehouse_id=NEW.warehouse_id),0)
  + COALESCE((SELECT OLD.quantity WHERE OLD.product_id=NEW.product_id AND OLD.warehouse_id=NEW.warehouse_id),0) < NEW.quantity;
END;
CREATE TRIGGER sale_edit_stock AFTER UPDATE OF product_id,warehouse_id,quantity ON sales WHEN OLD.cancelled_at IS NULL AND NEW.cancelled_at IS NULL
 AND (OLD.product_id<>NEW.product_id OR OLD.warehouse_id<>NEW.warehouse_id OR OLD.quantity<>NEW.quantity) BEGIN
 UPDATE stock SET quantity=quantity+OLD.quantity WHERE product_id=OLD.product_id AND warehouse_id=OLD.warehouse_id;
 UPDATE stock SET quantity=quantity-NEW.quantity WHERE product_id=NEW.product_id AND warehouse_id=NEW.warehouse_id;
 INSERT INTO movements(product_id,warehouse_id,delta,kind,sale_id) VALUES(OLD.product_id,OLD.warehouse_id,OLD.quantity,'sale_edit_return',NEW.id);
 INSERT INTO movements(product_id,warehouse_id,delta,kind,sale_id) VALUES(NEW.product_id,NEW.warehouse_id,-NEW.quantity,'sale_edit_out',NEW.id);
END;
