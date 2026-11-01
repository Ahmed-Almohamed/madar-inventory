-- Durable, transaction-local replication. No passwords, sessions or authentication logs.
CREATE TABLE odoo_state(id INTEGER PRIMARY KEY CHECK(id=1),instance TEXT NOT NULL,lease_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0,last_success TEXT);
INSERT INTO odoo_state(id,instance) VALUES(1,lower(hex(randomblob(16))));
CREATE TABLE IF NOT EXISTS odoo_actor(id INTEGER PRIMARY KEY CHECK(id=1),name TEXT,operation TEXT);
INSERT OR IGNORE INTO odoo_actor(id) VALUES(1);
CREATE TABLE odoo_outbox(id INTEGER PRIMARY KEY AUTOINCREMENT,entity TEXT NOT NULL,record_key TEXT NOT NULL,action TEXT NOT NULL,payload TEXT NOT NULL,actor TEXT NOT NULL DEFAULT '',operation TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT(datetime('now')),delivered_at TEXT,attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,error TEXT);
CREATE INDEX odoo_pending ON odoo_outbox(id) WHERE delivered_at IS NULL;

-- products
INSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT 'products',CAST(id AS TEXT),'baseline',json_object('id',id,'name',name,'sku',sku,'price_cents',price_cents,'low_stock',low_stock),'قبل تفعيل الربط' FROM products;
CREATE TRIGGER odoo_products_insert AFTER INSERT ON products BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('products',CAST(NEW.id AS TEXT),'insert',json_object('id',NEW.id,'name',NEW.name,'sku',NEW.sku,'price_cents',NEW.price_cents,'low_stock',NEW.low_stock),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_products_update AFTER UPDATE ON products WHEN json_object('id',NEW.id,'name',NEW.name,'sku',NEW.sku,'price_cents',NEW.price_cents,'low_stock',NEW.low_stock)<>json_object('id',OLD.id,'name',OLD.name,'sku',OLD.sku,'price_cents',OLD.price_cents,'low_stock',OLD.low_stock) BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('products',CAST(NEW.id AS TEXT),'update',json_object('id',NEW.id,'name',NEW.name,'sku',NEW.sku,'price_cents',NEW.price_cents,'low_stock',NEW.low_stock),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_products_delete AFTER DELETE ON products BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('products',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'name',OLD.name,'sku',OLD.sku,'price_cents',OLD.price_cents,'low_stock',OLD.low_stock),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;

-- warehouses
INSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT 'warehouses',CAST(id AS TEXT),'baseline',json_object('id',id,'name',name,'address',address,'governorate',governorate,'request_id',request_id,'custody_owner_id',custody_owner_id),'قبل تفعيل الربط' FROM warehouses;
CREATE TRIGGER odoo_warehouses_insert AFTER INSERT ON warehouses BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('warehouses',CAST(NEW.id AS TEXT),'insert',json_object('id',NEW.id,'name',NEW.name,'address',NEW.address,'governorate',NEW.governorate,'request_id',NEW.request_id,'custody_owner_id',NEW.custody_owner_id),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_warehouses_update AFTER UPDATE ON warehouses WHEN json_object('id',NEW.id,'name',NEW.name,'address',NEW.address,'governorate',NEW.governorate,'request_id',NEW.request_id,'custody_owner_id',NEW.custody_owner_id)<>json_object('id',OLD.id,'name',OLD.name,'address',OLD.address,'governorate',OLD.governorate,'request_id',OLD.request_id,'custody_owner_id',OLD.custody_owner_id) BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('warehouses',CAST(NEW.id AS TEXT),'update',json_object('id',NEW.id,'name',NEW.name,'address',NEW.address,'governorate',NEW.governorate,'request_id',NEW.request_id,'custody_owner_id',NEW.custody_owner_id),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_warehouses_delete AFTER DELETE ON warehouses BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('warehouses',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'name',OLD.name,'address',OLD.address,'governorate',OLD.governorate,'request_id',OLD.request_id,'custody_owner_id',OLD.custody_owner_id),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;

-- technicians
INSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT 'technicians',CAST(id AS TEXT),'baseline',json_object('id',id,'name',name,'phone',phone,'warehouse_id',warehouse_id,'request_id',request_id,'custody_warehouse_id',custody_warehouse_id,'stock_warehouse_id',stock_warehouse_id),'قبل تفعيل الربط' FROM technicians;
CREATE TRIGGER odoo_technicians_insert AFTER INSERT ON technicians BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('technicians',CAST(NEW.id AS TEXT),'insert',json_object('id',NEW.id,'name',NEW.name,'phone',NEW.phone,'warehouse_id',NEW.warehouse_id,'request_id',NEW.request_id,'custody_warehouse_id',NEW.custody_warehouse_id,'stock_warehouse_id',NEW.stock_warehouse_id),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_technicians_update AFTER UPDATE ON technicians WHEN json_object('id',NEW.id,'name',NEW.name,'phone',NEW.phone,'warehouse_id',NEW.warehouse_id,'request_id',NEW.request_id,'custody_warehouse_id',NEW.custody_warehouse_id,'stock_warehouse_id',NEW.stock_warehouse_id)<>json_object('id',OLD.id,'name',OLD.name,'phone',OLD.phone,'warehouse_id',OLD.warehouse_id,'request_id',OLD.request_id,'custody_warehouse_id',OLD.custody_warehouse_id,'stock_warehouse_id',OLD.stock_warehouse_id) BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('technicians',CAST(NEW.id AS TEXT),'update',json_object('id',NEW.id,'name',NEW.name,'phone',NEW.phone,'warehouse_id',NEW.warehouse_id,'request_id',NEW.request_id,'custody_warehouse_id',NEW.custody_warehouse_id,'stock_warehouse_id',NEW.stock_warehouse_id),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_technicians_delete AFTER DELETE ON technicians BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('technicians',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'name',OLD.name,'phone',OLD.phone,'warehouse_id',OLD.warehouse_id,'request_id',OLD.request_id,'custody_warehouse_id',OLD.custody_warehouse_id,'stock_warehouse_id',OLD.stock_warehouse_id),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;

-- warehouse_technicians
INSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT 'warehouse_technicians',CAST(warehouse_id AS TEXT) || ':' || CAST(technician_id AS TEXT),'baseline',json_object('warehouse_id',warehouse_id,'technician_id',technician_id),'قبل تفعيل الربط' FROM warehouse_technicians;
CREATE TRIGGER odoo_warehouse_technicians_insert AFTER INSERT ON warehouse_technicians BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('warehouse_technicians',CAST(NEW.warehouse_id AS TEXT) || ':' || CAST(NEW.technician_id AS TEXT),'insert',json_object('warehouse_id',NEW.warehouse_id,'technician_id',NEW.technician_id),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_warehouse_technicians_update AFTER UPDATE ON warehouse_technicians WHEN json_object('warehouse_id',NEW.warehouse_id,'technician_id',NEW.technician_id)<>json_object('warehouse_id',OLD.warehouse_id,'technician_id',OLD.technician_id) BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('warehouse_technicians',CAST(NEW.warehouse_id AS TEXT) || ':' || CAST(NEW.technician_id AS TEXT),'update',json_object('warehouse_id',NEW.warehouse_id,'technician_id',NEW.technician_id),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_warehouse_technicians_delete AFTER DELETE ON warehouse_technicians BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('warehouse_technicians',CAST(OLD.warehouse_id AS TEXT) || ':' || CAST(OLD.technician_id AS TEXT),'delete',json_object('warehouse_id',OLD.warehouse_id,'technician_id',OLD.technician_id),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;

-- stock
INSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT 'stock',CAST(product_id AS TEXT) || ':' || CAST(warehouse_id AS TEXT),'baseline',json_object('product_id',product_id,'warehouse_id',warehouse_id,'quantity',quantity),'قبل تفعيل الربط' FROM stock;
CREATE TRIGGER odoo_stock_insert AFTER INSERT ON stock BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('stock',CAST(NEW.product_id AS TEXT) || ':' || CAST(NEW.warehouse_id AS TEXT),'insert',json_object('product_id',NEW.product_id,'warehouse_id',NEW.warehouse_id,'quantity',NEW.quantity),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_stock_update AFTER UPDATE ON stock WHEN json_object('product_id',NEW.product_id,'warehouse_id',NEW.warehouse_id,'quantity',NEW.quantity)<>json_object('product_id',OLD.product_id,'warehouse_id',OLD.warehouse_id,'quantity',OLD.quantity) BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('stock',CAST(NEW.product_id AS TEXT) || ':' || CAST(NEW.warehouse_id AS TEXT),'update',json_object('product_id',NEW.product_id,'warehouse_id',NEW.warehouse_id,'quantity',NEW.quantity),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_stock_delete AFTER DELETE ON stock BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('stock',CAST(OLD.product_id AS TEXT) || ':' || CAST(OLD.warehouse_id AS TEXT),'delete',json_object('product_id',OLD.product_id,'warehouse_id',OLD.warehouse_id,'quantity',OLD.quantity),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;

-- sales
INSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT 'sales',CAST(id AS TEXT),'baseline',json_object('id',id,'request_id',request_id,'product_id',product_id,'warehouse_id',warehouse_id,'quantity',quantity,'price_cents',price_cents,'customer',customer,'phone',phone,'address',address,'source',source,'notes',notes,'sold_on',sold_on,'created_at',created_at,'cancelled_at',cancelled_at,'technician_id',technician_id,'installation_fee_cents',installation_fee_cents,'shipping_fee_cents',shipping_fee_cents,'sim_code',sim_code,'revision',revision),'قبل تفعيل الربط' FROM sales;
CREATE TRIGGER odoo_sales_insert AFTER INSERT ON sales BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('sales',CAST(NEW.id AS TEXT),'insert',json_object('id',NEW.id,'request_id',NEW.request_id,'product_id',NEW.product_id,'warehouse_id',NEW.warehouse_id,'quantity',NEW.quantity,'price_cents',NEW.price_cents,'customer',NEW.customer,'phone',NEW.phone,'address',NEW.address,'source',NEW.source,'notes',NEW.notes,'sold_on',NEW.sold_on,'created_at',NEW.created_at,'cancelled_at',NEW.cancelled_at,'technician_id',NEW.technician_id,'installation_fee_cents',NEW.installation_fee_cents,'shipping_fee_cents',NEW.shipping_fee_cents,'sim_code',NEW.sim_code,'revision',NEW.revision),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_sales_update AFTER UPDATE ON sales WHEN json_object('id',NEW.id,'request_id',NEW.request_id,'product_id',NEW.product_id,'warehouse_id',NEW.warehouse_id,'quantity',NEW.quantity,'price_cents',NEW.price_cents,'customer',NEW.customer,'phone',NEW.phone,'address',NEW.address,'source',NEW.source,'notes',NEW.notes,'sold_on',NEW.sold_on,'created_at',NEW.created_at,'cancelled_at',NEW.cancelled_at,'technician_id',NEW.technician_id,'installation_fee_cents',NEW.installation_fee_cents,'shipping_fee_cents',NEW.shipping_fee_cents,'sim_code',NEW.sim_code,'revision',NEW.revision)<>json_object('id',OLD.id,'request_id',OLD.request_id,'product_id',OLD.product_id,'warehouse_id',OLD.warehouse_id,'quantity',OLD.quantity,'price_cents',OLD.price_cents,'customer',OLD.customer,'phone',OLD.phone,'address',OLD.address,'source',OLD.source,'notes',OLD.notes,'sold_on',OLD.sold_on,'created_at',OLD.created_at,'cancelled_at',OLD.cancelled_at,'technician_id',OLD.technician_id,'installation_fee_cents',OLD.installation_fee_cents,'shipping_fee_cents',OLD.shipping_fee_cents,'sim_code',OLD.sim_code,'revision',OLD.revision) BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('sales',CAST(NEW.id AS TEXT),'update',json_object('id',NEW.id,'request_id',NEW.request_id,'product_id',NEW.product_id,'warehouse_id',NEW.warehouse_id,'quantity',NEW.quantity,'price_cents',NEW.price_cents,'customer',NEW.customer,'phone',NEW.phone,'address',NEW.address,'source',NEW.source,'notes',NEW.notes,'sold_on',NEW.sold_on,'created_at',NEW.created_at,'cancelled_at',NEW.cancelled_at,'technician_id',NEW.technician_id,'installation_fee_cents',NEW.installation_fee_cents,'shipping_fee_cents',NEW.shipping_fee_cents,'sim_code',NEW.sim_code,'revision',NEW.revision),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_sales_delete AFTER DELETE ON sales BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('sales',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'request_id',OLD.request_id,'product_id',OLD.product_id,'warehouse_id',OLD.warehouse_id,'quantity',OLD.quantity,'price_cents',OLD.price_cents,'customer',OLD.customer,'phone',OLD.phone,'address',OLD.address,'source',OLD.source,'notes',OLD.notes,'sold_on',OLD.sold_on,'created_at',OLD.created_at,'cancelled_at',OLD.cancelled_at,'technician_id',OLD.technician_id,'installation_fee_cents',OLD.installation_fee_cents,'shipping_fee_cents',OLD.shipping_fee_cents,'sim_code',OLD.sim_code,'revision',OLD.revision),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;

-- movements
INSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT 'movements',CAST(id AS TEXT),'baseline',json_object('id',id,'product_id',product_id,'warehouse_id',warehouse_id,'delta',delta,'kind',kind,'note',note,'sale_id',sale_id,'request_id',request_id,'created_at',created_at),'قبل تفعيل الربط' FROM movements;
CREATE TRIGGER odoo_movements_insert AFTER INSERT ON movements BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('movements',CAST(NEW.id AS TEXT),'insert',json_object('id',NEW.id,'product_id',NEW.product_id,'warehouse_id',NEW.warehouse_id,'delta',NEW.delta,'kind',NEW.kind,'note',NEW.note,'sale_id',NEW.sale_id,'request_id',NEW.request_id,'created_at',NEW.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_movements_update AFTER UPDATE ON movements WHEN json_object('id',NEW.id,'product_id',NEW.product_id,'warehouse_id',NEW.warehouse_id,'delta',NEW.delta,'kind',NEW.kind,'note',NEW.note,'sale_id',NEW.sale_id,'request_id',NEW.request_id,'created_at',NEW.created_at)<>json_object('id',OLD.id,'product_id',OLD.product_id,'warehouse_id',OLD.warehouse_id,'delta',OLD.delta,'kind',OLD.kind,'note',OLD.note,'sale_id',OLD.sale_id,'request_id',OLD.request_id,'created_at',OLD.created_at) BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('movements',CAST(NEW.id AS TEXT),'update',json_object('id',NEW.id,'product_id',NEW.product_id,'warehouse_id',NEW.warehouse_id,'delta',NEW.delta,'kind',NEW.kind,'note',NEW.note,'sale_id',NEW.sale_id,'request_id',NEW.request_id,'created_at',NEW.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_movements_delete AFTER DELETE ON movements BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('movements',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'product_id',OLD.product_id,'warehouse_id',OLD.warehouse_id,'delta',OLD.delta,'kind',OLD.kind,'note',OLD.note,'sale_id',OLD.sale_id,'request_id',OLD.request_id,'created_at',OLD.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;

-- stock_transfers
INSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT 'stock_transfers',CAST(request_id AS TEXT),'baseline',json_object('request_id',request_id,'product_id',product_id,'from_warehouse_id',from_warehouse_id,'to_warehouse_id',to_warehouse_id,'quantity',quantity,'created_at',created_at),'قبل تفعيل الربط' FROM stock_transfers;
CREATE TRIGGER odoo_stock_transfers_insert AFTER INSERT ON stock_transfers BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('stock_transfers',CAST(NEW.request_id AS TEXT),'insert',json_object('request_id',NEW.request_id,'product_id',NEW.product_id,'from_warehouse_id',NEW.from_warehouse_id,'to_warehouse_id',NEW.to_warehouse_id,'quantity',NEW.quantity,'created_at',NEW.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_stock_transfers_update AFTER UPDATE ON stock_transfers WHEN json_object('request_id',NEW.request_id,'product_id',NEW.product_id,'from_warehouse_id',NEW.from_warehouse_id,'to_warehouse_id',NEW.to_warehouse_id,'quantity',NEW.quantity,'created_at',NEW.created_at)<>json_object('request_id',OLD.request_id,'product_id',OLD.product_id,'from_warehouse_id',OLD.from_warehouse_id,'to_warehouse_id',OLD.to_warehouse_id,'quantity',OLD.quantity,'created_at',OLD.created_at) BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('stock_transfers',CAST(NEW.request_id AS TEXT),'update',json_object('request_id',NEW.request_id,'product_id',NEW.product_id,'from_warehouse_id',NEW.from_warehouse_id,'to_warehouse_id',NEW.to_warehouse_id,'quantity',NEW.quantity,'created_at',NEW.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_stock_transfers_delete AFTER DELETE ON stock_transfers BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('stock_transfers',CAST(OLD.request_id AS TEXT),'delete',json_object('request_id',OLD.request_id,'product_id',OLD.product_id,'from_warehouse_id',OLD.from_warehouse_id,'to_warehouse_id',OLD.to_warehouse_id,'quantity',OLD.quantity,'created_at',OLD.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;

-- stock_history
INSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT 'stock_history',CAST(id AS TEXT),'baseline',json_object('id',id,'product_id',product_id,'warehouse_id',warehouse_id,'old_quantity',old_quantity,'new_quantity',new_quantity,'created_at',created_at),'قبل تفعيل الربط' FROM stock_history;
CREATE TRIGGER odoo_stock_history_insert AFTER INSERT ON stock_history BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('stock_history',CAST(NEW.id AS TEXT),'insert',json_object('id',NEW.id,'product_id',NEW.product_id,'warehouse_id',NEW.warehouse_id,'old_quantity',NEW.old_quantity,'new_quantity',NEW.new_quantity,'created_at',NEW.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_stock_history_update AFTER UPDATE ON stock_history WHEN json_object('id',NEW.id,'product_id',NEW.product_id,'warehouse_id',NEW.warehouse_id,'old_quantity',NEW.old_quantity,'new_quantity',NEW.new_quantity,'created_at',NEW.created_at)<>json_object('id',OLD.id,'product_id',OLD.product_id,'warehouse_id',OLD.warehouse_id,'old_quantity',OLD.old_quantity,'new_quantity',OLD.new_quantity,'created_at',OLD.created_at) BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('stock_history',CAST(NEW.id AS TEXT),'update',json_object('id',NEW.id,'product_id',NEW.product_id,'warehouse_id',NEW.warehouse_id,'old_quantity',NEW.old_quantity,'new_quantity',NEW.new_quantity,'created_at',NEW.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_stock_history_delete AFTER DELETE ON stock_history BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('stock_history',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'product_id',OLD.product_id,'warehouse_id',OLD.warehouse_id,'old_quantity',OLD.old_quantity,'new_quantity',OLD.new_quantity,'created_at',OLD.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;

-- client_directory
INSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT 'client_directory',CAST(id AS TEXT),'baseline',json_object('id',id,'request_id',request_id,'name',name,'category',category,'city',city,'phone',phone,'details',details,'price_cents',price_cents,'quantity',quantity,'notes',notes,'revision',revision,'created_at',created_at),'قبل تفعيل الربط' FROM client_directory;
CREATE TRIGGER odoo_client_directory_insert AFTER INSERT ON client_directory BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('client_directory',CAST(NEW.id AS TEXT),'insert',json_object('id',NEW.id,'request_id',NEW.request_id,'name',NEW.name,'category',NEW.category,'city',NEW.city,'phone',NEW.phone,'details',NEW.details,'price_cents',NEW.price_cents,'quantity',NEW.quantity,'notes',NEW.notes,'revision',NEW.revision,'created_at',NEW.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_client_directory_update AFTER UPDATE ON client_directory WHEN json_object('id',NEW.id,'request_id',NEW.request_id,'name',NEW.name,'category',NEW.category,'city',NEW.city,'phone',NEW.phone,'details',NEW.details,'price_cents',NEW.price_cents,'quantity',NEW.quantity,'notes',NEW.notes,'revision',NEW.revision,'created_at',NEW.created_at)<>json_object('id',OLD.id,'request_id',OLD.request_id,'name',OLD.name,'category',OLD.category,'city',OLD.city,'phone',OLD.phone,'details',OLD.details,'price_cents',OLD.price_cents,'quantity',OLD.quantity,'notes',OLD.notes,'revision',OLD.revision,'created_at',OLD.created_at) BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('client_directory',CAST(NEW.id AS TEXT),'update',json_object('id',NEW.id,'request_id',NEW.request_id,'name',NEW.name,'category',NEW.category,'city',NEW.city,'phone',NEW.phone,'details',NEW.details,'price_cents',NEW.price_cents,'quantity',NEW.quantity,'notes',NEW.notes,'revision',NEW.revision,'created_at',NEW.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_client_directory_delete AFTER DELETE ON client_directory BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('client_directory',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'request_id',OLD.request_id,'name',OLD.name,'category',OLD.category,'city',OLD.city,'phone',OLD.phone,'details',OLD.details,'price_cents',OLD.price_cents,'quantity',OLD.quantity,'notes',OLD.notes,'revision',OLD.revision,'created_at',OLD.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;

-- product_images
INSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT 'product_images',CAST(product_id AS TEXT),'baseline',json_object('product_id',product_id,'data_url',data_url),'قبل تفعيل الربط' FROM product_images;
CREATE TRIGGER odoo_product_images_insert AFTER INSERT ON product_images BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('product_images',CAST(NEW.product_id AS TEXT),'insert',json_object('product_id',NEW.product_id,'data_url',NEW.data_url),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_product_images_update AFTER UPDATE ON product_images WHEN json_object('product_id',NEW.product_id,'data_url',NEW.data_url)<>json_object('product_id',OLD.product_id,'data_url',OLD.data_url) BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('product_images',CAST(NEW.product_id AS TEXT),'update',json_object('product_id',NEW.product_id,'data_url',NEW.data_url),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_product_images_delete AFTER DELETE ON product_images BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('product_images',CAST(OLD.product_id AS TEXT),'delete',json_object('product_id',OLD.product_id,'data_url',OLD.data_url),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;

-- expenses
INSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT 'expenses',CAST(id AS TEXT),'baseline',json_object('id',id,'request_id',request_id,'amount_cents',amount_cents,'currency',currency,'details',details,'paid_on',paid_on,'created_by',created_by,'created_at',created_at),'قبل تفعيل الربط' FROM expenses;
CREATE TRIGGER odoo_expenses_insert AFTER INSERT ON expenses BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('expenses',CAST(NEW.id AS TEXT),'insert',json_object('id',NEW.id,'request_id',NEW.request_id,'amount_cents',NEW.amount_cents,'currency',NEW.currency,'details',NEW.details,'paid_on',NEW.paid_on,'created_by',NEW.created_by,'created_at',NEW.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_expenses_update AFTER UPDATE ON expenses WHEN json_object('id',NEW.id,'request_id',NEW.request_id,'amount_cents',NEW.amount_cents,'currency',NEW.currency,'details',NEW.details,'paid_on',NEW.paid_on,'created_by',NEW.created_by,'created_at',NEW.created_at)<>json_object('id',OLD.id,'request_id',OLD.request_id,'amount_cents',OLD.amount_cents,'currency',OLD.currency,'details',OLD.details,'paid_on',OLD.paid_on,'created_by',OLD.created_by,'created_at',OLD.created_at) BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('expenses',CAST(NEW.id AS TEXT),'update',json_object('id',NEW.id,'request_id',NEW.request_id,'amount_cents',NEW.amount_cents,'currency',NEW.currency,'details',NEW.details,'paid_on',NEW.paid_on,'created_by',NEW.created_by,'created_at',NEW.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_expenses_delete AFTER DELETE ON expenses BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('expenses',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'request_id',OLD.request_id,'amount_cents',OLD.amount_cents,'currency',OLD.currency,'details',OLD.details,'paid_on',OLD.paid_on,'created_by',OLD.created_by,'created_at',OLD.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;

-- users
INSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT 'users',CAST(id AS TEXT),'baseline',json_object('id',id,'username',username,'name',name,'role',role,'active',active,'created_at',created_at),'قبل تفعيل الربط' FROM users;
CREATE TRIGGER odoo_users_insert AFTER INSERT ON users BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('users',CAST(NEW.id AS TEXT),'insert',json_object('id',NEW.id,'username',NEW.username,'name',NEW.name,'role',NEW.role,'active',NEW.active,'created_at',NEW.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_users_update AFTER UPDATE ON users WHEN json_object('id',NEW.id,'username',NEW.username,'name',NEW.name,'role',NEW.role,'active',NEW.active,'created_at',NEW.created_at)<>json_object('id',OLD.id,'username',OLD.username,'name',OLD.name,'role',OLD.role,'active',OLD.active,'created_at',OLD.created_at) BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('users',CAST(NEW.id AS TEXT),'update',json_object('id',NEW.id,'username',NEW.username,'name',NEW.name,'role',NEW.role,'active',NEW.active,'created_at',NEW.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_users_delete AFTER DELETE ON users BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('users',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'username',OLD.username,'name',OLD.name,'role',OLD.role,'active',OLD.active,'created_at',OLD.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;

-- activity
INSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT 'activity',CAST(id AS TEXT),'baseline',json_object('id',id,'actor_id',actor_id,'path',path,'details',details,'created_at',created_at),'قبل تفعيل الربط' FROM activity;
CREATE TRIGGER odoo_activity_insert AFTER INSERT ON activity BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('activity',CAST(NEW.id AS TEXT),'insert',json_object('id',NEW.id,'actor_id',NEW.actor_id,'path',NEW.path,'details',NEW.details,'created_at',NEW.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_activity_update AFTER UPDATE ON activity WHEN json_object('id',NEW.id,'actor_id',NEW.actor_id,'path',NEW.path,'details',NEW.details,'created_at',NEW.created_at)<>json_object('id',OLD.id,'actor_id',OLD.actor_id,'path',OLD.path,'details',OLD.details,'created_at',OLD.created_at) BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('activity',CAST(NEW.id AS TEXT),'update',json_object('id',NEW.id,'actor_id',NEW.actor_id,'path',NEW.path,'details',NEW.details,'created_at',NEW.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
CREATE TRIGGER odoo_activity_delete AFTER DELETE ON activity BEGIN
 INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('activity',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'actor_id',OLD.actor_id,'path',OLD.path,'details',OLD.details,'created_at',OLD.created_at),COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));
END;
