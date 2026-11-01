import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const db=new DatabaseSync(':memory:');
for(const name of readdirSync('migrations').filter(n=>/^000\d|^0010/.test(n)).sort())db.exec(readFileSync('migrations/'+name,'utf8'));
const tables=['products','warehouses','technicians','warehouse_technicians','stock','sales','movements','stock_transfers','stock_history','client_directory','product_images','expenses','users','activity'];
let sql=`-- Durable, transaction-local replication. No passwords, sessions or authentication logs.
CREATE TABLE odoo_state(id INTEGER PRIMARY KEY CHECK(id=1),instance TEXT NOT NULL,lease_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0,last_success TEXT);
INSERT INTO odoo_state(id,instance) VALUES(1,lower(hex(randomblob(16))));
CREATE TABLE IF NOT EXISTS odoo_actor(id INTEGER PRIMARY KEY CHECK(id=1),name TEXT,operation TEXT);
INSERT OR IGNORE INTO odoo_actor(id) VALUES(1);
CREATE TABLE odoo_outbox(id INTEGER PRIMARY KEY AUTOINCREMENT,entity TEXT NOT NULL,record_key TEXT NOT NULL,action TEXT NOT NULL,payload TEXT NOT NULL,actor TEXT NOT NULL DEFAULT '',operation TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT(datetime('now')),delivered_at TEXT,attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,error TEXT);
CREATE INDEX odoo_pending ON odoo_outbox(id) WHERE delivered_at IS NULL;
`;
for(const table of tables){
 const columns=db.prepare(`PRAGMA table_info(${table})`).all().filter(c=>!['password_hash'].includes(c.name));
 const keys=columns.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name);
 const payload=prefix=>`json_object(${columns.flatMap(c=>[`'${c.name}'`,prefix+c.name]).join(',')})`;
 const key=prefix=>keys.map(c=>`CAST(${prefix}${c} AS TEXT)`).join(" || ':' || ");
 sql+=`\n-- ${table}\nINSERT INTO odoo_outbox(entity,record_key,action,payload,actor) SELECT '${table}',${key('')},'baseline',${payload('')},'قبل تفعيل الربط' FROM ${table};\n`;
 for(const [event,prefix] of [['INSERT','NEW.'],['UPDATE','NEW.'],['DELETE','OLD.']]){
  // User credential changes are intentionally excluded; public identity changes still replicate.
  const when=event==='UPDATE'?` WHEN ${payload('NEW.')}<>${payload('OLD.')}`:'';
  sql+=`CREATE TRIGGER odoo_${table}_${event.toLowerCase()} AFTER ${event} ON ${table}${when} BEGIN\n INSERT INTO odoo_outbox(entity,record_key,action,payload,actor,operation) VALUES('${table}',${key(prefix)},'${event.toLowerCase()}',${payload(prefix)},COALESCE((SELECT name FROM odoo_actor WHERE id=1),'نظام'),COALESCE((SELECT operation FROM odoo_actor WHERE id=1),''));\nEND;\n`;
 }
}
writeFileSync('migrations/0011_odoo_sync.sql',sql);
db.close();
