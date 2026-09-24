import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.js';
import {messages,translate} from '../public/i18n.js';
const firstMigration=readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');
const secondMigration=readFileSync(new URL('../migrations/0002_technicians.sql',import.meta.url),'utf8');
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');db.exec(firstMigration);db.exec(secondMigration);db.exec(readFileSync(new URL('../migrations/0003_warehouse_details.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0004_product_images.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0005_shipping_fee.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0006_customers_sim_sale_edits.sql',import.meta.url),'utf8'));
 function prepare(sql){let args=[];const stmt=db.prepare(sql);return {bind(...v){args=v;return this;},async first(){return stmt.get(...args)||null;},async run(){const r=stmt.run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};},async all(){return {results:stmt.all(...args)};}};}
 const env={DB:{prepare,async batch(stmts){db.exec('BEGIN');try{const results=[];for(const s of stmts)results.push(await s.all());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}}};
 const req=async(path,data,headers={})=>{const response=await worker.fetch(new Request('https://madar.test/api/'+path,{method:data?'POST':'GET',headers:{Origin:'https://madar.test','Content-Type':'application/json',...headers},...(data?{body:JSON.stringify(data)}:{})}),env);return {status:response.status,body:await response.json()};};
 return {db,env,req,async seed(){await req('products',{name:'GT06N',price_cents:4500});await req('warehouses',{name:'Damascus',address:'',governorate:'دمشق',devices:[],technician_ids:[],request_id:crypto.randomUUID()});await req('warehouses',{name:'Aleppo',address:'',governorate:'حلب',devices:[],technician_ids:[],request_id:crypto.randomUUID()});await req('technicians',{name:'Installer',phone:'',warehouse_id:1,request_id:crypto.randomUUID()});await req('stock',{product_id:1,warehouse_id:1,quantity:10,request_id:crypto.randomUUID()});}};
}
const sale=()=>({request_id:crypto.randomUUID(),product_id:1,warehouse_id:1,quantity:3,price_cents:4550,customer:'Test customer',phone:'0999999999',address:'Damascus',source:'إنستغرام',sold_on:'2026-01-01',technician_id:1,installation_fee_cents:1500});
test('SIM costs exactly $5, is searchable and unique among active sales',async()=>{const {req,seed,db}=setup();await seed();const d={...sale(),has_sim:true,sim_code:'sim-001',sim_fee_cents:999};assert.equal((await req('sales',d)).status,201);const row=(await req('sales?q=sim-001')).body.items[0];assert.equal(row.sim_code,'SIM-001');assert.equal(row.sim_fee_cents,500);assert.equal((await req('sales',{...d,request_id:crypto.randomUUID()})).body.error,'sim_duplicate');for(const sim_code of ['', ' ', '<bad>'])assert.equal((await req('sales',{...d,request_id:crypto.randomUUID(),sim_code})).status,400);await req('sales/1/cancel',{});assert.equal((await req('sales',{...d,request_id:crypto.randomUUID()})).status,201);db.close();});
test('Customers group formatted phone numbers, search historical SIMs and retain full purchases',async()=>{const {req,seed,db}=setup();await seed();await req('sales',{...sale(),phone:'0999 999 999',has_sim:true,sim_code:'OLD-1'});await req('sales',{...sale(),customer:'New name',address:'New address',sold_on:'2026-01-02',shipping_fee_cents:200});await req('sales',{...sale(),phone:'0888888888'});const result=(await req('customers?q=old-1')).body;assert.equal(result.total,1);const c=result.items[0];assert.equal(c.customer,'New name');assert.equal(c.address,'New address');assert.equal(c.units,6);assert.equal(c.total_cents,31000);assert.equal((await req('sales?customer_phone=0999999999')).body.total,2);assert.equal((await req('customers?customer_phone=0888888888')).body.total,1);await req('sales/1/cancel',{});assert.equal((await req('customers?q=old-1')).body.items[0].units,3);assert.equal((await req('customers?q=missing')).body.total,0);db.close();});
test('Editing sale quantity or location updates stock atomically and prevents stale edits',async()=>{const {req,seed,db}=setup();await seed();await req('sales',sale());const edit={...sale(),revision:1,quantity:6,has_sim:true,sim_code:'EDIT-1'};assert.equal((await req('sales/1/edit',edit)).status,200);assert.equal(db.prepare('SELECT quantity FROM stock WHERE warehouse_id=1').get().quantity,4);assert.equal((await req('sales/1/edit',edit)).status,409);assert.equal((await req('sales/1/edit',{...edit,revision:2,warehouse_id:2})).status,409);assert.equal(db.prepare('SELECT quantity FROM stock WHERE warehouse_id=1').get().quantity,4);await req('stock',{product_id:1,warehouse_id:2,quantity:8,request_id:crypto.randomUUID()});assert.equal((await req('sales/1/edit',{...edit,revision:2,warehouse_id:2})).status,200);assert.equal(db.prepare('SELECT quantity FROM stock WHERE warehouse_id=1').get().quantity,10);assert.equal(db.prepare('SELECT quantity FROM stock WHERE warehouse_id=2').get().quantity,2);await req('sales/1/cancel',{});assert.equal(db.prepare('SELECT quantity FROM stock WHERE warehouse_id=2').get().quantity,8);assert.equal((await req('sales/1/edit',{...edit,revision:3})).status,409);assert.equal((await req('sales/1/edit',{...edit,revision:4,quantity:100,warehouse_id:1})).status,200);assert.equal(db.prepare('SELECT quantity FROM stock WHERE warehouse_id=1').get().quantity,10);assert.ok(db.prepare('SELECT cancelled_at FROM sales WHERE id=1').get().cancelled_at);db.close();});
test('Editing product and customer moves history; duplicate SIM or missing references roll back',async()=>{const {req,seed,db}=setup();await seed();await req('products',{name:'Other device',price_cents:100});await req('stock',{product_id:2,warehouse_id:1,quantity:5,request_id:crypto.randomUUID()});await req('sales',{...sale(),has_sim:true,sim_code:'FIRST'});await req('sales',{...sale(),has_sim:true,sim_code:'SECOND'});const d={...sale(),revision:1,quantity:2,product_id:2,phone:'0888888888',has_sim:true,sim_code:'SECOND'};assert.equal((await req('sales/1/edit',d)).status,409);assert.equal((await req('sales/1/edit',{...d,sim_code:'THIRD',technician_id:999})).status,400);assert.equal(db.prepare('SELECT quantity FROM stock WHERE product_id=1').get().quantity,4);assert.equal(db.prepare('SELECT quantity FROM stock WHERE product_id=2').get().quantity,5);assert.equal((await req('sales/1/edit',{...d,has_sim:false})).status,200);assert.equal(db.prepare('SELECT quantity FROM stock WHERE product_id=1').get().quantity,7);assert.equal(db.prepare('SELECT quantity FROM stock WHERE product_id=2').get().quantity,3);assert.equal((await req('customers?customer_phone=0888888888')).body.items[0].units,2);assert.equal((await req('sales?q=FIRST')).body.total,0);db.close();});
test('Device sales exclude other devices, retain cancellations and show correct warehouse balances',async()=>{const {req,seed,db}=setup();await seed();await req('products',{name:'Other',price_cents:100});await req('stock',{product_id:2,warehouse_id:2,quantity:5,request_id:crypto.randomUUID()});await req('sales',sale());await req('sales',{...sale(),product_id:2,warehouse_id:2});let result=(await req('sales?product_id=1')).body;assert.equal(result.total,1);assert.equal(result.items[0].product_id,1);assert.equal((await req('sales?product_id=1&page=2')).body.items.length,0);assert.equal((await req('sales?product_id=bad')).status,400);await req('sales/1/cancel',{});assert.ok((await req('sales?product_id=1')).body.items[0].cancelled_at);const stock=(await req('overview')).body.stock;assert.equal(stock.find(x=>x.product_id===1&&x.warehouse_id===1).quantity,10);assert.equal(stock.find(x=>x.product_id===2&&x.warehouse_id===2).quantity,2);db.close();});
test('Self installation works without any technicians and cancellation restores stock',async()=>{
 const {req,db}=setup();await req('products',{name:'Device',price_cents:100});await req('warehouses',{name:'Store',governorate:'حلب',devices:[{product_id:1,quantity:5}],technician_ids:[],request_id:crypto.randomUUID()});
 const d={...sale(),technician_id:null,installation_fee_cents:0};assert.equal((await req('sales',d)).status,201);assert.equal((await req('sales',d)).status,200);
 const row=(await req('sales?technician_id=none')).body.items[0];assert.equal(row.technician_id,null);assert.equal(row.installation_fee_cents,0);assert.equal(db.prepare('SELECT quantity FROM stock').get().quantity,2);
 await req('sales/1/cancel',{});assert.equal(db.prepare('SELECT quantity FROM stock').get().quantity,5);db.close();
});
test('Technician and governorate filters combine with existing search; zero fee technician sales remain valid',async()=>{
 const {req,seed,db}=setup();await seed();await req('stock',{product_id:1,warehouse_id:2,quantity:10,request_id:crypto.randomUUID()});
 await req('sales',{...sale(),installation_fee_cents:0});await req('sales',{...sale(),warehouse_id:2,technician_id:null,installation_fee_cents:0});
 assert.equal((await req('sales?technician_id=1')).body.total,1);assert.equal((await req('sales?technician_id=none')).body.total,1);
 assert.equal((await req('sales?governorate='+encodeURIComponent('حلب'))).body.items[0].warehouse_id,2);
 assert.equal((await req('sales?technician_id=1&governorate='+encodeURIComponent('حلب'))).body.total,0);
 assert.equal((await req('sales?technician_id=none&q=customer&governorate='+encodeURIComponent('حلب'))).body.total,1);
 assert.equal((await req('sales?governorate=bad')).status,400);assert.equal((await req('sales?technician_id=bad')).status,400);db.close();
});
test('Technician reports distinguish installations and shared stock, deduplicate, filter and exclude cancellations from totals',async()=>{
 const {req,seed,db}=setup();await seed();
 await req('technicians',{name:'Other installer',request_id:crypto.randomUUID()});
 await req('stock',{product_id:1,warehouse_id:2,quantity:50,request_id:crypto.randomUUID()});
 const fixtures=[{}, {warehouse_id:2}, {technician_id:2}, {warehouse_id:2,technician_id:2}, {sold_on:'2026-01-02'}];
 for(const patch of fixtures)assert.equal((await req('sales',{...sale(),quantity:1,...patch})).status,201);
 await req('sales/5/cancel',{});
 const report=(await req('sales?report_technician=1')).body;
 assert.deepEqual(report.items.map(x=>x.id),[5,3,2,1]);
 assert.equal(report.total,4);assert.deepEqual(report.summary,{count:3,units:3,revenue:13650,fees:3000});
 assert.equal(report.items[0].phone,'0999999999');assert.equal(report.items[0].governorate,'دمشق');
 assert.deepEqual((await req('sales?report_technician=1&kind=installed')).body.items.map(x=>x.id),[5,2,1]);
 assert.deepEqual((await req('sales?report_technician=1&kind=warehouse')).body.items.map(x=>x.id),[5,3,1]);
 assert.equal((await req('sales?report_technician=1&from=2026-01-02')).body.summary.count,0);
 assert.equal((await req('sales?report_technician=1&to=2026-01-01')).body.total,3);
 assert.equal((await req('sales?report_technician=999')).status,404);
 assert.equal((await req('sales?report_technician=1&kind=bad')).status,400);
 await req('warehouses/1/access',{technician_ids:[]});
 assert.deepEqual((await req('sales?report_technician=1')).body.items.map(x=>x.id),[5,2,1]);db.close();
});
test('Report totals include every page and independent technicians retain installation history',async()=>{
 const {req,seed,db}=setup();await seed();await req('stock',{product_id:1,warehouse_id:1,quantity:30,request_id:crypto.randomUUID()});
 for(let i=0;i<27;i++)await req('sales',{...sale(),quantity:1});
 const first=(await req('sales?report_technician=1')).body,second=(await req('sales?report_technician=1&page=2')).body;
 assert.equal(first.items.length,25);assert.equal(second.items.length,2);assert.equal(first.total,27);assert.equal(first.summary.fees,40500);assert.deepEqual(first.summary,second.summary);
 db.close();
});
test('Direct access without login or secrets; cross-origin writes are still rejected',async()=>{const {req,db}=setup();assert.equal((await req('overview')).status,200);assert.equal((await req('products',{name:'Device',price_cents:1000},{Origin:'https://other.test'})).status,403);assert.equal((await req('login',{})).status,404);db.close();});
test('Products require only name and price; inventory API hides retired fields',async()=>{const {req,db}=setup();assert.equal((await req('products',{name:'Tracker',price_cents:2500})).status,201);const p=(await req('overview')).body.products[0];assert.deepEqual(Object.keys(p).sort(),['has_image','id','name','price_cents']);db.close();});
test('Sale records technician and fee, deducts exact stock and is retry-safe',async()=>{const {req,seed,db}=setup();await seed();const d=sale();assert.equal((await req('sales',d)).status,201);assert.equal((await req('sales',d)).status,200);assert.equal(db.prepare('SELECT quantity FROM stock').get().quantity,7);assert.equal(db.prepare('SELECT count(*) n FROM sales').get().n,1);const row=(await req('sales')).body.items[0];assert.equal(row.technician,'Installer');assert.equal(row.installation_fee_cents,1500);db.close();});
test('Overselling and sales from an empty warehouse are rolled back',async()=>{const {req,seed,db}=setup();await seed();assert.equal((await req('sales',{...sale(),quantity:11})).status,409);assert.equal((await req('sales',{...sale(),warehouse_id:2})).status,409);assert.equal(db.prepare('SELECT quantity FROM stock').get().quantity,10);assert.equal(db.prepare('SELECT count(*) n FROM sales').get().n,0);db.close();});
test('Competing purchases cannot consume the same stock twice',async()=>{const {req,seed,db}=setup();await seed();const r=await Promise.all([req('sales',{...sale(),quantity:8}),req('sales',{...sale(),quantity:8})]);assert.deepEqual(r.map(x=>x.status).sort(),[201,409]);assert.equal(db.prepare('SELECT quantity FROM stock').get().quantity,2);db.close();});
test('Cancellation restores stock once and excludes device revenue and installation fees',async()=>{const {req,seed,db}=setup();await seed();const day=(await req('overview')).body.today;await req('sales',{...sale(),sold_on:day});let summary=(await req('overview')).body.summary;assert.equal(summary.revenue,13650);assert.equal(summary.installation_fees,1500);assert.equal((await req('sales/1/cancel',{})).status,200);assert.equal((await req('sales/1/cancel',{})).status,409);assert.equal(db.prepare('SELECT quantity FROM stock').get().quantity,10);summary=(await req('overview')).body.summary;assert.equal(summary.revenue,0);assert.equal(summary.installation_fees,0);db.close();});
test('Add stock needs no note, is retry-safe and rejects nonpositive quantities',async()=>{const {req,seed,db}=setup();await seed();const d={product_id:1,warehouse_id:1,quantity:4,request_id:crypto.randomUUID()};assert.equal((await req('stock',d)).status,201);assert.equal((await req('stock',d)).status,200);assert.equal(db.prepare('SELECT quantity FROM stock').get().quantity,14);for(const quantity of [-1,0,1.5])assert.equal((await req('stock',{...d,quantity,request_id:crypto.randomUUID()})).status,400);db.close();});
test('Create technician with their own warehouse atomically; stock and sale use same warehouse',async()=>{const {req,db}=setup();await req('products',{name:'Device',price_cents:5000});const tech={name:'Mobile technician',create_warehouse:true,governorate:'دمشق',request_id:crypto.randomUUID()};assert.equal((await req('technicians',tech)).status,201);assert.equal((await req('technicians',tech)).status,200);const overview=(await req('overview')).body;assert.equal(overview.warehouses.length,1);assert.equal(overview.technicians[0].warehouse_id,overview.warehouses[0].id);await req('stock',{product_id:1,warehouse_id:1,quantity:2,request_id:crypto.randomUUID()});assert.equal((await req('sales',{...sale(),quantity:1})).status,201);assert.equal(db.prepare('SELECT quantity FROM stock').get().quantity,1);db.close();});
test('Independent technician and existing warehouse link work without duplicating stock',async()=>{const {req,seed,db}=setup();await seed();assert.equal((await req('technicians',{name:'Independent',request_id:crypto.randomUUID()})).status,201);assert.equal((await req('technicians',{name:'Shared location',warehouse_id:1,request_id:crypto.randomUUID()})).status,201);const data=(await req('overview')).body;assert.equal(data.technicians.find(x=>x.name==='Independent').warehouse_id,null);assert.equal(data.warehouses.length,2);assert.equal(data.stock.length,1);db.close();});
test('Invalid technician and invalid fees cannot create a sale or change stock',async()=>{const {req,seed,db}=setup();await seed();for(const patch of [{technician_id:null},{installation_fee_cents:-1},{installation_fee_cents:1.5},{quantity:1.5},{price_cents:-1},{source:'bad'},{sold_on:'2026-02-30'},{sold_on:'9999-01-01'},{phone:'abc'}])assert.equal((await req('sales',{...sale(),...patch})).status,400,JSON.stringify(patch));assert.equal((await req('sales',{...sale(),technician_id:999})).status,400);assert.equal(db.prepare('SELECT quantity FROM stock').get().quantity,10);db.close();});
test('Search supports technician, customer and source filters',async()=>{const {req,seed,db}=setup();await seed();await req('sales',sale());assert.equal((await req('sales?q=Installer')).body.total,1);assert.equal((await req('sales?q=customer')).body.total,1);assert.equal((await req('sales?source='+encodeURIComponent('فيسبوك'))).body.total,0);assert.equal((await req('sales?page=2')).body.items.length,0);db.close();});
test('Upgrade preserves existing sales and inventory with no fabricated technician',()=>{const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');db.exec(firstMigration);db.exec(`INSERT INTO products(name,sku,price_cents) VALUES('Old device','OLD',4500); INSERT INTO warehouses(name) VALUES('Old warehouse'); INSERT INTO stock VALUES(1,1,10); INSERT INTO sales(request_id,product_id,warehouse_id,quantity,price_cents,phone,address,source,sold_on) VALUES('legacy-sale',1,1,2,4500,'0999999999','Damascus','توصية','2026-01-01');`);db.exec(secondMigration);assert.equal(db.prepare('SELECT quantity FROM stock').get().quantity,8);const s=db.prepare('SELECT * FROM sales').get();assert.equal(s.technician_id,null);assert.equal(s.installation_fee_cents,0);assert.equal(s.price_cents,4500);db.close();});
test('Every translation has Arabic and English; retired wording is absent from current UI',()=>{for(const [key,pair]of Object.entries(messages)){assert.equal(pair.length,2,key);assert.ok(pair.every(s=>typeof s==='string'&&s.length),key);assert.doesNotMatch(pair[0],/مبيعة/);assert.doesNotMatch(pair[1],/[\u0600-\u06ff]/,key);}assert.equal(translate('en','stock_at',{count:4}),'Available in this warehouse: 4');const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');for(const match of source.matchAll(/\bt\('([^']+)'/g)){if(match[1]!=='error_')assert.ok(messages[match[1]],match[1]);}assert.doesNotMatch(source,/showLogin|low_stock|\bsku\b|مبيعة/);});

test('Warehouse creation saves governorate, several device quantities and shared technician access once',async()=>{
 const {req,seed,db}=setup();await seed();await req('products',{name:'Second',price_cents:1000});
 const data={name:'New warehouse',governorate:'حمص',address:'Street',devices:[{product_id:1,quantity:7},{product_id:2,quantity:4}],technician_ids:[1],request_id:crypto.randomUUID()};
 assert.equal((await req('warehouses',data)).status,201);assert.equal((await req('warehouses',data)).status,200);
 const result=(await req('overview')).body,w=result.warehouses.find(x=>x.name==='New warehouse');assert.equal(w.governorate,'حمص');
 assert.equal(result.stock.filter(x=>x.warehouse_id===w.id).reduce((n,x)=>n+x.quantity,0),11);
 assert.equal(result.warehouse_technicians.filter(x=>x.technician_id===1).length,2);db.close();
});
test('Warehouse creation is atomic for invalid devices and technicians',async()=>{
 const {req,seed,db}=setup();await seed();
 const base={name:'Invalid warehouse',governorate:'دمشق',devices:[{product_id:1,quantity:5}],technician_ids:[999],request_id:crypto.randomUUID()};
 assert.equal((await req('warehouses',base)).status,400);assert.equal(db.prepare('SELECT COUNT(*) n FROM warehouses').get().n,2);assert.equal(db.prepare('SELECT SUM(quantity) n FROM stock').get().n,10);
 assert.equal((await req('warehouses',{...base,technician_ids:[],devices:[{product_id:999,quantity:1}]})).status,400);
 assert.equal((await req('warehouses',{...base,governorate:'invalid'})).status,400);db.close();
});
test('Updating warehouse access does not change stock or access to other warehouses',async()=>{
 const {req,seed,db}=setup();await seed();assert.equal((await req('warehouses/2/access',{technician_ids:[1]})).status,200);
 assert.equal((await req('overview')).body.warehouse_technicians.length,2);
 assert.equal((await req('warehouses/1/access',{technician_ids:[]})).status,200);
 const rows=(await req('overview')).body.warehouse_technicians;assert.equal(rows.length,1);assert.equal(rows[0].warehouse_id,2);assert.equal(db.prepare('SELECT quantity FROM stock').get().quantity,10);db.close();
});

test('Invalid image uploads do not leave partial products',async()=>{const {req,db}=setup();for(const image of ['data:image/svg+xml;base64,PHN2Zz4=', 'https://example.com/image.jpg','data:image/jpeg;base64,YWJjZA==']){assert.equal((await req('products',{name:'Bad image',price_cents:100,image})).status,400);}assert.equal(db.prepare('SELECT COUNT(*) n FROM products').get().n,0);db.close();});
test('Photo is stored separately and served as an image without bloating overview',async()=>{const {req,env,db}=setup();const image='data:image/jpeg;base64,/9j/2Q==';assert.equal((await req('products',{name:'Photo device',price_cents:100,image})).status,201);const p=(await req('overview')).body.products[0];assert.equal(p.has_image,1);assert.equal(p.image,undefined);const response=await worker.fetch(new Request('https://madar.test/api/products/1/image'),env);assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/jpeg');assert.equal((await response.arrayBuffer()).byteLength,4);db.close();});

test('Shipping is optional, validated, preserved on retry and separate from device and installer amounts',async()=>{const {req,seed,db}=setup();await seed();const d={...sale(),shipping_fee_cents:725,technician_id:null,installation_fee_cents:0};assert.equal((await req('sales',d)).status,201);assert.equal((await req('sales',d)).status,200);let rows=(await req('sales')).body.items;assert.equal(rows[0].shipping_fee_cents,725);assert.equal(rows[0].price_cents,4550);assert.equal(rows[0].installation_fee_cents,0);for(const value of [-1,1.5,100000001,'5'])assert.equal((await req('sales',{...sale(),shipping_fee_cents:value})).status,400);assert.equal((await req('sales',sale())).status,201);rows=(await req('sales')).body.items;assert.equal(rows[0].shipping_fee_cents,0);assert.equal(db.prepare('SELECT quantity FROM stock').get().quantity,4);await req('sales/1/cancel',{});assert.equal((await req('sales')).body.items.find(x=>x.id===1).shipping_fee_cents,725);db.close();});

test('Product edits preserve stock and sale prices; photos can be kept, replaced or removed atomically',async()=>{
 const {req,seed,db}=setup();await seed();await req('sales',sale());
 const photo='data:image/jpeg;base64,/9j/2Q==';
 assert.equal((await req('products/1/edit',{name:'Updated',price_cents:6000,image:photo})).status,200);
 assert.equal((await req('products/1/edit',{name:'Renamed',price_cents:7000})).status,200);
 assert.equal(db.prepare('SELECT data_url FROM product_images WHERE product_id=1').get().data_url,photo);
 assert.equal(db.prepare('SELECT quantity FROM stock WHERE product_id=1 AND warehouse_id=1').get().quantity,7);
 const saved=(await req('sales')).body.items[0];assert.equal(saved.product,'Renamed');assert.equal(saved.price_cents,4550);
 assert.equal((await req('products/1/edit',{name:'Invalid',price_cents:1,image:'broken'})).status,400);
 assert.equal(db.prepare('SELECT name FROM products WHERE id=1').get().name,'Renamed');
 assert.equal((await req('products/1/edit',{name:'Renamed',price_cents:7000,image:''})).status,200);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM product_images').get().n,0);
 assert.equal((await req('products/999/edit',{name:'Missing',price_cents:1})).status,404);
});

test('Stock corrections set absolute quantities, reject stale writes and retry safely',async()=>{
 const {req,seed,db}=setup();await seed();
 const d={product_id:1,warehouse_id:1,quantity:4,expected_quantity:10,request_id:crypto.randomUUID()};
 assert.equal((await req('stock/edit',d)).status,200);assert.equal((await req('stock/edit',d)).status,200);
 assert.equal(db.prepare('SELECT quantity FROM stock WHERE warehouse_id=1').get().quantity,4);
 assert.equal((await req('stock/edit',{...d,request_id:crypto.randomUUID(),quantity:9})).status,409);
 assert.equal((await req('stock/edit',{...d,request_id:crypto.randomUUID(),expected_quantity:4,quantity:0})).status,200);
 assert.equal(db.prepare('SELECT quantity FROM stock WHERE warehouse_id=1').get().quantity,0);
 assert.equal((await req('stock/edit',{...d,request_id:crypto.randomUUID(),warehouse_id:2,expected_quantity:0,quantity:5})).status,200);
 assert.equal(db.prepare('SELECT quantity FROM stock WHERE warehouse_id=2').get().quantity,5);
 assert.equal((await req('stock/edit',{...d,quantity:-1})).status,400);
});
test('Warehouse and technician edits preserve sales and atomically replace access',async()=>{
 const {req,seed,db}=setup();await seed();await req('sales',sale());
 assert.equal((await req('warehouses/1/edit',{name:'Office',address:'Updated',governorate:'حلب',technician_ids:[1]})).status,200);
 assert.equal((await req('technicians/1/edit',{name:'Renamed',phone:'0998888888',warehouse_ids:[2]})).status,200);
 assert.deepEqual((await req('overview')).body.warehouse_technicians.map(x=>[x.warehouse_id,x.technician_id]),[[2,1]]);
 const record=(await req('sales')).body.items[0];assert.equal(record.technician,'Renamed');assert.equal(record.warehouse,'Office');assert.equal(record.quantity,3);
 assert.equal((await req('warehouses/1/edit',{name:'Bad',address:'',governorate:'حلب',technician_ids:[999]})).status,400);
 assert.equal(db.prepare('SELECT name FROM warehouses WHERE id=1').get().name,'Office');
 assert.equal((await req('technicians/1/edit',{name:'Bad',phone:'',warehouse_ids:[999]})).status,400);
 assert.equal(db.prepare('SELECT name FROM technicians WHERE id=1').get().name,'Renamed');
 assert.equal((await req('technicians/1/edit',{name:'Renamed',phone:'',warehouse_ids:[]})).status,200);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM warehouse_technicians').get().n,0);
});
