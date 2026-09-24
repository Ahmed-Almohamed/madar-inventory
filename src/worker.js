// Source values remain compatible with existing records.
const GOVERNORATES=['دمشق','ريف دمشق','حلب','حمص','حماة','اللاذقية','طرطوس','إدلب','درعا','السويداء','القنيطرة','دير الزور','الرقة','الحسكة'];
const SOURCES=['إنستغرام','فيسبوك','توصية','تسويق ميداني','أخرى'];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
function fail(code,status=400,field){throw Object.assign(new Error(code),{status,field});}
function str(v,field,max=200,required=true){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail('invalid_field',400,field);return v.trim();}
function integer(v,field,min=1,max=1000000){if(!Number.isSafeInteger(v)||v<min||v>max)fail('invalid_field',400,field);return v;}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)fail('invalid_date');return v;}
function requestId(v){if(typeof v!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(v))fail('invalid_request');return v;}
async function body(req,max=16000){if(!req.headers.get('content-type')?.includes('application/json'))fail('invalid_request',415);const text=await req.text();if(text.length>max)fail('request_large',413);try{const d=JSON.parse(text);if(!d||typeof d!=='object'||Array.isArray(d))fail('invalid_request');return d;}catch{fail('invalid_request');}}
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Damascus',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const phoneKey=column=>`replace(replace(replace(replace(replace(${column},' ',''),'-',''),'(',''),')',''),'+','')`;
const simFee=column=>`CASE WHEN ${column}<>'' THEN 500 ELSE 0 END`;
function saleValues(d){
 if(!SOURCES.includes(d.source))fail('invalid_field',400,'source');
 const phone=str(d.phone,'phone',30);if(!/^[+\d\s()-]{6,30}$/.test(phone))fail('invalid_field',400,'phone');
 const soldOn=date(d.sold_on);if(soldOn>today())fail('future_date');
 const tech=d.technician_id==null?null:integer(d.technician_id,'technician');
 const fee=integer(d.installation_fee_cents??0,'installation_fee',0,100000000);if(tech===null&&fee!==0)fail('invalid_field',400,'installation_fee');
 if(d.has_sim!==undefined&&typeof d.has_sim!=='boolean')fail('invalid_field',400,'has_sim');
 const sim=d.has_sim?str(d.sim_code,'sim_code',80).toUpperCase():'';
 if(sim&&!/^[A-Z0-9-]+$/.test(sim))fail('invalid_field',400,'sim_code');
 return [integer(d.product_id,'device'),integer(d.warehouse_id,'warehouse'),integer(d.quantity,'quantity'),integer(d.price_cents,'unit_price',0,100000000),str(d.customer||'','customer',200,false),phone,str(d.address,'address',500),d.source,str(d.notes||'','notes',1000,false),soldOn,tech,fee,integer(d.shipping_fee_cents??0,'shipping_fee',0,100000000),sim];
}
async function api(req,env){
 const url=new URL(req.url),path=url.pathname,method=req.method,db=env.DB;
 if(!['GET','POST'].includes(method))fail('method_not_allowed',405);
 // No application sign-in. Cross-origin write protection remains enabled.
 if(method!=='GET'&&req.headers.get('Origin')!==url.origin)fail('origin_not_allowed',403);
 if(path==='/api/overview'&&method==='GET'){
  const day=today(),month=day.slice(0,7)+'-01';
  const r=await db.batch([
   db.prepare('SELECT id,name,price_cents,EXISTS(SELECT 1 FROM product_images i WHERE i.product_id=products.id) has_image FROM products ORDER BY name'),db.prepare('SELECT * FROM warehouses ORDER BY name'),db.prepare('SELECT * FROM stock'),
   db.prepare(`SELECT COUNT(*) count,COALESCE(SUM(quantity),0) units,COALESCE(SUM(quantity*price_cents),0) revenue,COALESCE(SUM(installation_fee_cents),0) installation_fees FROM sales WHERE cancelled_at IS NULL AND sold_on BETWEEN ? AND ?`).bind(month,day),
   db.prepare('SELECT t.*,w.name warehouse FROM technicians t LEFT JOIN warehouses w ON w.id=t.warehouse_id ORDER BY t.name'),db.prepare('SELECT * FROM warehouse_technicians')
  ]);
  return json({products:r[0].results,warehouses:r[1].results,stock:r[2].results,summary:r[3].results[0],technicians:r[4].results,warehouse_technicians:r[5].results,today:day});
 }
 if(/^\/api\/products\/\d+\/image$/.test(path)&&method==='GET'){
  const row=await db.prepare('SELECT data_url FROM product_images WHERE product_id=?').bind(Number(path.split('/')[3])).first();
  if(!row)fail('not_found',404);
  const bytes=Uint8Array.from(atob(row.data_url.split(',')[1]),c=>c.charCodeAt(0));
  return new Response(bytes,{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-cache'}});
 }
 if((path==='/api/products'||/^\/api\/products\/\d+\/edit$/.test(path))&&method==='POST'){
  const d=await body(req,300000),sku=crypto.randomUUID(),statements=[];
  const id=path==='/api/products'?null:Number(path.split('/')[3]);
  if(id&&!await db.prepare('SELECT id FROM products WHERE id=?').bind(id).first())fail('not_found',404);
  if(d.image!==undefined&&typeof d.image!=='string')fail('invalid_image');
  const name=str(d.name,'device_name'),price=integer(d.price_cents,'unit_price',0,100000000);
  statements.push(id?db.prepare('UPDATE products SET name=?,price_cents=? WHERE id=?').bind(name,price,id):db.prepare('INSERT INTO products(name,sku,price_cents,low_stock) VALUES(?,?,?,0)').bind(name,sku,price));
  if(d.image){
   if(typeof d.image!=='string'||d.image.length>280000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(d.image))fail('invalid_image');
   let bytes;try{bytes=atob(d.image.split(',')[1]);}catch{fail('invalid_image');}
   if(bytes.length>200000||bytes.length<4||bytes.charCodeAt(0)!==255||bytes.charCodeAt(1)!==216||bytes.charCodeAt(bytes.length-2)!==255||bytes.charCodeAt(bytes.length-1)!==217)fail('invalid_image');
   statements.push(id?db.prepare('INSERT INTO product_images(product_id,data_url) VALUES(?,?) ON CONFLICT(product_id) DO UPDATE SET data_url=excluded.data_url').bind(id,d.image):db.prepare('INSERT INTO product_images(product_id,data_url) VALUES((SELECT id FROM products WHERE sku=?),?)').bind(sku,d.image));
  }
  if(id&&d.image==='')statements.push(db.prepare('DELETE FROM product_images WHERE product_id=?').bind(id));
  await db.batch(statements);return json({ok:true},id?200:201);
 }
 if(path==='/api/warehouses'&&method==='POST'){
  const d=await body(req),id=requestId(d.request_id);
  if(await db.prepare('SELECT id FROM warehouses WHERE request_id=?').bind(id).first())return json({ok:true});
  const name=str(d.name,'warehouse_name'),address=str(d.address||'','address',300,false);
  if(!GOVERNORATES.includes(d.governorate))fail('invalid_field',400,'governorate');
  if(!Array.isArray(d.devices)||d.devices.length>100||!Array.isArray(d.technician_ids)||d.technician_ids.length>100)fail('invalid_request');
  const devices=d.devices.map(x=>({product_id:integer(x.product_id,'device'),quantity:integer(x.quantity,'quantity')}));
  const techs=d.technician_ids.map(x=>integer(x,'technician'));
  if(devices.length+techs.length>45)fail('invalid_request');
  if(new Set(devices.map(x=>x.product_id)).size!==devices.length||new Set(techs).size!==techs.length)fail('invalid_request');
  await db.batch([
   db.prepare('INSERT INTO warehouses(name,address,governorate,request_id) VALUES(?,?,?,?)').bind(name,address,d.governorate,id),
   ...devices.map(x=>db.prepare(`INSERT INTO movements(product_id,warehouse_id,delta,kind,note,request_id) VALUES(?,(SELECT id FROM warehouses WHERE request_id=?),?,'adjustment','',?)`).bind(x.product_id,id,x.quantity,crypto.randomUUID())),
   ...techs.map(x=>db.prepare('INSERT INTO warehouse_technicians(warehouse_id,technician_id) VALUES((SELECT id FROM warehouses WHERE request_id=?),?)').bind(id,x))
  ]);return json({ok:true},201);
 }
 if(/^\/api\/warehouses\/\d+\/access$/.test(path)&&method==='POST'){
  const warehouse=Number(path.split('/')[3]),d=await body(req);
  if(!Array.isArray(d.technician_ids)||d.technician_ids.length>100)fail('invalid_request');
  const ids=[...new Set(d.technician_ids.map(x=>integer(x,'technician')))];
  if(!await db.prepare('SELECT id FROM warehouses WHERE id=?').bind(warehouse).first())fail('not_found',404);
  await db.batch([db.prepare('DELETE FROM warehouse_technicians WHERE warehouse_id=?').bind(warehouse),...ids.map(id=>db.prepare('INSERT INTO warehouse_technicians VALUES(?,?)').bind(warehouse,id))]);return json({ok:true});
 }
 if(path==='/api/technicians'&&method==='POST'){
  const d=await body(req),id=requestId(d.request_id);
  const existing=await db.prepare('SELECT id FROM technicians WHERE request_id=?').bind(id).first();if(existing)return json({ok:true,id:existing.id});
  const name=str(d.name,'technician_name'),phone=str(d.phone||'','phone',30,false);
  if(phone&&!/^[+\d\s()-]{6,30}$/.test(phone))fail('invalid_field',400,'phone');
  if(d.create_warehouse!==undefined&&typeof d.create_warehouse!=='boolean')fail('invalid_request');
  if(d.create_warehouse&&d.warehouse_id)fail('invalid_request');
  const warehouse=d.warehouse_id==null?null:integer(d.warehouse_id,'warehouse');
  if(d.create_warehouse){
   if(!GOVERNORATES.includes(d.governorate))fail('invalid_field',400,'governorate');
   // D1 batch is atomic: create both records or neither.
   await db.batch([db.prepare('INSERT INTO warehouses(name,address,governorate) VALUES(?,?,?)').bind(name,'',d.governorate),db.prepare('INSERT INTO technicians(name,phone,warehouse_id,request_id) VALUES(?,?,(SELECT id FROM warehouses WHERE name=?),?)').bind(name,phone,name,id)]);
  }else await db.prepare('INSERT INTO technicians(name,phone,warehouse_id,request_id) VALUES(?,?,?,?)').bind(name,phone,warehouse,id).run();
  return json({ok:true},201);
 }
 if(path==='/api/stock'&&method==='POST'){
  const d=await body(req),id=requestId(d.request_id);if(await db.prepare('SELECT id FROM movements WHERE request_id=?').bind(id).first())return json({ok:true});
  await db.prepare(`INSERT INTO movements(product_id,warehouse_id,delta,kind,note,request_id) VALUES(?,?,?,'adjustment',?,?)`).bind(integer(d.product_id,'device'),integer(d.warehouse_id,'warehouse'),integer(d.quantity,'quantity'),str(d.note||'','notes',500,false),id).run();return json({ok:true},201);
 }
 if(path==='/api/sales'&&method==='POST'){
  const d=await body(req),id=requestId(d.request_id);const existing=await db.prepare('SELECT id FROM sales WHERE request_id=?').bind(id).first();if(existing)return json({ok:true,id:existing.id});
  const r=await db.prepare('INSERT INTO sales(request_id,product_id,warehouse_id,quantity,price_cents,customer,phone,address,source,notes,sold_on,technician_id,installation_fee_cents,shipping_fee_cents,sim_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,...saleValues(d)).run();return json({ok:true,id:r.meta.last_row_id},201);
 }
 if(/^\/api\/sales\/\d+\/edit$/.test(path)&&method==='POST'){
  const id=Number(path.split('/')[3]),d=await body(req),values=saleValues(d),revision=integer(d.revision,'revision');
  const result=await db.prepare('UPDATE sales SET product_id=?,warehouse_id=?,quantity=?,price_cents=?,customer=?,phone=?,address=?,source=?,notes=?,sold_on=?,technician_id=?,installation_fee_cents=?,shipping_fee_cents=?,sim_code=?,revision=revision+1 WHERE id=? AND revision=?').bind(...values,id,revision).run();
  if(!result.meta.changes){if(!await db.prepare('SELECT id FROM sales WHERE id=?').bind(id).first())fail('not_found',404);fail('sale_changed',409);}
  return json({ok:true,id});
 }
 if(path==='/api/customers'&&method==='GET'){
  const page=Math.max(1,Math.floor(Number(url.searchParams.get('page'))||1)),q=(url.searchParams.get('q')||'').slice(0,100);
  const cte=`WITH history AS (SELECT s.*,${phoneKey('s.phone')} customer_key FROM sales s), ranked AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY customer_key ORDER BY sold_on DESC,id DESC) rn FROM history), totals AS (SELECT customer_key,COUNT(*) records,SUM(CASE WHEN cancelled_at IS NULL THEN quantity ELSE 0 END) units,SUM(CASE WHEN cancelled_at IS NULL THEN quantity*price_cents+installation_fee_cents+shipping_fee_cents+${simFee('sim_code')} ELSE 0 END) total_cents FROM history GROUP BY customer_key)`;
  const from=` FROM ranked r JOIN totals t ON t.customer_key=r.customer_key WHERE r.rn=1 AND (?='' OR r.customer_key IN (SELECT customer_key FROM history WHERE instr(lower(customer),lower(?))>0 OR instr(phone,?)>0 OR instr(customer_key,?)>0 OR instr(lower(address),lower(?))>0 OR instr(lower(sim_code),lower(?))>0))`;
  const exact=url.searchParams.get('customer_phone');
  const args=[q,q,q,q.replace(/[+\s()-]/g,''),q,q];
  const exactWhere=exact===null?'':' AND r.customer_key=?';if(exact!==null)args.push(exact.replace(/[+\s()-]/g,''));
  const result=await db.batch([db.prepare(cte+' SELECT r.customer_key,r.customer,r.phone,r.address,r.sold_on,t.records,t.units,t.total_cents'+from+exactWhere+' ORDER BY r.sold_on DESC,r.id DESC LIMIT 25 OFFSET ?').bind(...args,(page-1)*25),db.prepare(cte+' SELECT COUNT(*) total'+from+exactWhere).bind(...args)]);
  return json({items:result[0].results,total:result[1].results[0].total,page});
 }
 if(/^\/api\/sales\/\d+\/cancel$/.test(path)&&method==='POST'){
  const r=await db.prepare(`UPDATE sales SET cancelled_at=datetime('now'),revision=revision+1 WHERE id=? AND cancelled_at IS NULL`).bind(Number(path.split('/')[3])).run();if(!r.meta.changes)fail('already_cancelled',409);return json({ok:true});
 }
 if(path==='/api/sales'&&method==='GET'){
  const page=Math.floor(Math.max(1,Math.min(100000,Number(url.searchParams.get('page'))||1)));
  const q=(url.searchParams.get('q')||'').slice(0,100),source=url.searchParams.get('source')||'';
  const from=url.searchParams.get('from')||'0001-01-01',to=url.searchParams.get('to')||'9999-12-31';date(from);date(to);
  let where=` WHERE s.sold_on BETWEEN ? AND ? AND (?='' OR s.source=?) AND (?='' OR instr(lower(s.customer),lower(?))>0 OR instr(s.phone,?)>0 OR instr(lower(p.name),lower(?))>0 OR instr(lower(t.name),lower(?))>0 OR instr(lower(s.sim_code),lower(?))>0)`;
  const args=[from,to,source,source,q,...Array(5).fill(q)];
  const customerPhone=url.searchParams.get('customer_phone');
  if(customerPhone!==null){where+=' AND '+phoneKey('s.phone')+'=?';args.push(customerPhone.replace(/[+\s()-]/g,''));}
  const productFilter=url.searchParams.get('product_id');
  if(productFilter!==null){where+=' AND s.product_id=?';args.push(integer(Number(productFilter),'device'));}
  const techFilter=url.searchParams.get('technician_id')||'',province=url.searchParams.get('governorate')||'';
  if(techFilter==='none')where+=' AND s.technician_id IS NULL';
  else if(techFilter){where+=' AND s.technician_id=?';args.push(integer(Number(techFilter),'technician'));}
  if(province){if(!GOVERNORATES.includes(province))fail('invalid_field',400,'governorate');where+=' AND w.governorate=?';args.push(province);}
  const reportId=url.searchParams.get('report_technician');let technician=null;
  if(reportId!==null){
   technician=integer(Number(reportId),'technician');
   if(!await db.prepare('SELECT id FROM technicians WHERE id=?').bind(technician).first())fail('not_found',404);
   const kind=url.searchParams.get('kind')||'all';if(!['all','installed','warehouse'].includes(kind))fail('invalid_request');
   const linked='s.warehouse_id IN (SELECT warehouse_id FROM warehouse_technicians WHERE technician_id=?)';
   if(kind==='installed'){where+=' AND s.technician_id=?';args.push(technician);}
   else if(kind==='warehouse'){where+=' AND '+linked;args.push(technician);}
   else{where+=' AND (s.technician_id=? OR '+linked+')';args.push(technician,technician);}
  }
  const base=' FROM sales s JOIN products p ON p.id=s.product_id JOIN warehouses w ON w.id=s.warehouse_id LEFT JOIN technicians t ON t.id=s.technician_id';
  const queries=[db.prepare('SELECT s.*,'+simFee('s.sim_code')+' sim_fee_cents,p.name product,w.name warehouse,w.governorate,t.name technician'+base+where+' ORDER BY s.sold_on DESC,s.id DESC LIMIT 25 OFFSET ?').bind(...args,(page-1)*25),db.prepare('SELECT COUNT(*) total'+base+where).bind(...args)];
  if(technician!==null)queries.push(db.prepare(`SELECT COUNT(*) count,COALESCE(SUM(s.quantity),0) units,COALESCE(SUM(s.quantity*s.price_cents),0) revenue,COALESCE(SUM(CASE WHEN s.technician_id=? THEN s.installation_fee_cents ELSE 0 END),0) fees`+base+where+' AND s.cancelled_at IS NULL').bind(technician,...args));
  const r=await db.batch(queries);
  return json({items:r[0].results,total:r[1].results[0].total,page,...(technician!==null?{summary:r[2].results[0]}:{})});
 }
 fail('not_found',404);
}
export default{async fetch(req,env){
 let response;
 try{response=new URL(req.url).pathname.startsWith('/api/')?await api(req,env):await env.ASSETS.fetch(req);}
 catch(e){let code=e.message,status=e.status||500;
  if(code.includes('INSUFFICIENT_STOCK')){code='insufficient_stock';status=409;}
  else if(code.includes('sales.sim_code')){code='sim_duplicate';status=409;}
  else if(code.includes('UNIQUE constraint')){code='duplicate';status=409;}
  else if(code.includes('FOREIGN KEY')){code='missing_record';status=400;}
  else if(!e.status){console.error(e);code='server_error';}
  response=json({error:code,...(e.field?{field:e.field}:{})},status);
 }
 const safe=new Response(response.body,response);
 safe.headers.set('X-Content-Type-Options','nosniff');safe.headers.set('Referrer-Policy','same-origin');safe.headers.set('X-Frame-Options','DENY');
 safe.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");return safe;
}};
