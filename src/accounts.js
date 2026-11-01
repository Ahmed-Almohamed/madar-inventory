const encode=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
export const digest=async s=>hex(await crypto.subtle.digest('SHA-256',encode.encode(s)));
export async function hashPassword(password,salt=hex(crypto.getRandomValues(new Uint8Array(16)))){
 const key=await crypto.subtle.importKey('raw',encode.encode(password),'PBKDF2',false,['deriveBits']);
 const hash=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encode.encode(salt),iterations:100000},key,256));return `pbkdf2$100000$${salt}$${hash}`;
}
export async function verifyPassword(password,stored){if(typeof password!=='string'||password.length>200)return false;const parts=stored.split('$');if(parts.length!==4||parts[0]!=='pbkdf2'||parts[1]!=='100000')return false;const actual=await hashPassword(password,parts[2]);let diff=actual.length^stored.length;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^stored.charCodeAt(i);return diff===0;}
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{status});};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const token=req=>(req.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('madar_session='))?.slice(14)||'';
const cookie=(req,value,age)=>`madar_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(req.url).protocol==='https:'?'; Secure':''}`;
const publicUser=u=>({id:u.id,username:u.username,name:u.name,role:u.role,active:u.active});
async function input(req){if(!req.headers.get('Content-Type')?.includes('application/json'))fail('invalid_request');const text=await req.text();if(text.length>16000)fail('request_large',413);try{const d=JSON.parse(text);if(!d||Array.isArray(d)||typeof d!=='object')fail('invalid_request');return d;}catch{fail('invalid_request');}}
export async function authenticate(req,env){
 const path=new URL(req.url).pathname,db=env.DB,now=Math.floor(Date.now()/1000);
 if(req.method==='POST'&&req.headers.get('Origin')!==new URL(req.url).origin)fail('origin_not_allowed',403);
 if(path==='/api/auth/login'&&req.method==='POST'){
  const d=await input(req),username=String(d.username||'').trim().toLowerCase();if(username.length>80||typeof d.password!=='string'||d.password.length>200)fail('invalid_credentials',401);
  const key=await digest('login:'+username+':'+(req.headers.get('CF-Connecting-IP')||'local'));
  const limit=await db.prepare('INSERT INTO auth_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts').bind(key,now+900,now,now).first();
  if(limit.attempts>10)fail('login_limited',429);
  const user=await db.prepare('SELECT * FROM users WHERE username=? AND active=1').bind(username).first();
  const valid=await verifyPassword(d.password,user?.password_hash||'pbkdf2$100000$00000000000000000000000000000000$'+ '0'.repeat(64));if(!user||!valid)fail('invalid_credentials',401);
  const value=hex(crypto.getRandomValues(new Uint8Array(32)));await db.batch([db.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now),db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token(req))),db.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await digest(value),user.id,now+43200),db.prepare('DELETE FROM auth_limits WHERE key=?').bind(key)]);
  const response=json({user:publicUser(user)});response.headers.set('Set-Cookie',cookie(req,value,43200));return {response};
 }
 const user=await db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').bind(await digest(token(req)),now).first();
 if(path==='/api/auth/logout'&&req.method==='POST'){await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token(req))).run();const response=json({ok:true});response.headers.set('Set-Cookie',cookie(req,'',0));return {response};}
 if(!user)fail('unauthorized',401);
 if(path==='/api/auth/me'&&req.method==='GET')return {response:json({user:publicUser(user)})};
 if(path.startsWith('/api/users')&&user.role!=='admin')fail('forbidden',403);
 return {user:publicUser(user)};
}
// Every business write and its attribution commit together, including batch operations.
export function auditedDB(db,user,path,details){
 const entry=(conditional=false)=>db.prepare('INSERT INTO activity(actor_id,path,details) SELECT ?,?,?'+(conditional?' WHERE changes()>0':'')).bind(user.id,path,JSON.stringify(details));
 const begin=()=>db.prepare('UPDATE odoo_actor SET name=?,operation=? WHERE id=1').bind(user.name,path);
 const end=()=>db.prepare('UPDATE odoo_actor SET name=NULL,operation=NULL WHERE id=1');
 return {prepare(sql){let stmt=db.prepare(sql);const write=/^\s*(INSERT|UPDATE|DELETE)/i.test(sql);const wrapped={get statement(){return stmt;},write,bind(...args){stmt=stmt.bind(...args);return wrapped;},first:()=>stmt.first(),all:()=>stmt.all(),async run(){if(!write)return stmt.run();const results=await db.batch([begin(),stmt,entry(true),end()]);return results[1];}};return wrapped;},async batch(stmts){const writes=stmts.some(s=>s.write),results=await db.batch([...(writes?[begin()]:[]),...stmts.map(s=>s.statement),...(writes?[entry(),end()]:[])]);return writes?results.slice(1,-2):results;}};
}
export async function accountApi(req,db,user){
 const url=new URL(req.url),path=url.pathname;
 if(path==='/api/admin/reset'&&req.method==='POST'){
  if(user.role!=='admin')fail('forbidden',403);
  const d=await input(req);
  if(!['مسح الكل','CLEAR ALL'].includes(d.confirmation)||! /^[a-zA-Z0-9-]{16,80}$/.test(d.request_id||''))fail('invalid_request');
  if(await db.prepare('SELECT 1 FROM workspace_resets WHERE request_id=? AND completed_at IS NOT NULL').bind(d.request_id).first())return json({ok:true});
  const guard='EXISTS(SELECT 1 FROM workspace_resets WHERE request_id=? AND completed_at IS NULL)';
  const statements=[db.prepare('INSERT INTO workspace_resets(request_id,actor_id) VALUES(?,?) ON CONFLICT DO NOTHING').bind(d.request_id,user.id)];
  for(const table of ['stock_transfers','movements','stock_history','sales','stock','product_images','warehouse_technicians','expenses','client_directory','activity'])statements.push(db.prepare(`DELETE FROM ${table} WHERE ${guard}`).bind(d.request_id));
  statements.push(db.prepare(`UPDATE technicians SET warehouse_id=NULL,custody_warehouse_id=NULL,stock_warehouse_id=NULL WHERE ${guard}`).bind(d.request_id));
  statements.push(db.prepare(`UPDATE warehouses SET custody_owner_id=NULL WHERE ${guard}`).bind(d.request_id));
  for(const table of ['technicians','warehouses','products'])statements.push(db.prepare(`DELETE FROM ${table} WHERE ${guard}`).bind(d.request_id));
  statements.push(db.prepare("UPDATE workspace_resets SET completed_at=datetime('now') WHERE request_id=? AND completed_at IS NULL").bind(d.request_id));
  await db.batch(statements);return json({ok:true});
 }
 if(path==='/api/users'&&req.method==='GET')return json({items:(await db.prepare('SELECT id,username,name,role,active,created_at FROM users ORDER BY id').all()).results});
 if(path==='/api/users'&&req.method==='POST'){
  const d=await input(req),username=String(d.username||'').trim().toLowerCase(),name=String(d.name||'').trim();if(!/^[a-z0-9._-]{3,60}$/.test(username)||!name||name.length>100||typeof d.password!=='string'||d.password.length<10||d.password.length>200)fail('invalid_account');
  await db.prepare("INSERT INTO users(username,name,password_hash,role) VALUES(?,?,?,'employee')").bind(username,name,await hashPassword(d.password)).run();return json({ok:true},201);
 }
 if(/^\/api\/users\/\d+\/edit$/.test(path)&&req.method==='POST'){
  const id=Number(path.split('/')[3]),d=await input(req),target=await db.prepare('SELECT * FROM users WHERE id=?').bind(id).first();if(!target)fail('not_found',404);if(target.role==='admin')fail('forbidden',403);if(typeof d.active!=='boolean')fail('invalid_account');
  if(d.password&&(typeof d.password!=='string'||d.password.length<10||d.password.length>200))fail('invalid_account');
  await db.batch([db.prepare('UPDATE users SET active=?,password_hash=? WHERE id=?').bind(d.active?1:0,d.password?await hashPassword(d.password):target.password_hash,id),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id)]);return json({ok:true});
 }
 if(path==='/api/expenses'&&req.method==='POST'){
  const d=await input(req);if(!Number.isSafeInteger(d.amount_cents)||d.amount_cents<1||d.amount_cents>100000000000||!['USD','SYP'].includes(d.currency)||typeof d.details!=='string'||!d.details.trim()||d.details.length>2000||!/^\d{4}-\d{2}-\d{2}$/.test(d.paid_on||'')||!Number.isFinite(Date.parse(d.paid_on))||new Date(d.paid_on).toISOString().slice(0,10)!==d.paid_on||d.paid_on>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Damascus',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())||! /^[a-zA-Z0-9-]{16,80}$/.test(d.request_id||''))fail('invalid_expense');
  await db.prepare('INSERT INTO expenses(request_id,amount_cents,currency,details,paid_on,created_by) VALUES(?,?,?,?,?,?) ON CONFLICT(request_id) DO NOTHING').bind(d.request_id,d.amount_cents,d.currency,d.details.trim(),d.paid_on,user.id).run();return json({ok:true},201);
 }
 if((path==='/api/expenses'||path==='/api/activity')&&req.method==='GET'){
  const page=Number(url.searchParams.get('page')||1);if(!Number.isSafeInteger(page)||page<1)fail('invalid_request');
  const expenses=path==='/api/expenses',table=expenses?'expenses':'activity',key=expenses?'created_by':'actor_id';
  const items=await db.prepare(`SELECT r.*,u.name actor,u.username FROM ${table} r JOIN users u ON u.id=r.${key} ORDER BY r.id DESC LIMIT 25 OFFSET ?`).bind((page-1)*25).all();const count=await db.prepare(`SELECT COUNT(*) total FROM ${table}`).first();
  return json({items:items.results,total:count.total,...(expenses?{totals:(await db.prepare('SELECT currency,SUM(amount_cents) total FROM expenses GROUP BY currency').all()).results}:{})});
 }
 return null;
}
