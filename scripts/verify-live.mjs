// Explicit live smoke test. Credentials arrive on stdin and are never logged.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.MADAR_URL||'https://madar-inventory.afaq-cloudflare.workers.dev';
const credentials=JSON.parse(fs.readFileSync(0,'utf8'));
assert.equal((await fetch(base+'/api/overview')).status,401);
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(credentials)});
assert.equal(login.status,200,'Live login');
const cookie=login.headers.get('set-cookie').split(';')[0];
assert.ok(login.headers.get('set-cookie').includes('Secure'));
async function request(path,data){const r=await fetch(base+'/api/'+path,{method:data?'POST':'GET',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});assert.ok(r.ok,`${path}: ${r.status}`);return r.json();}
try{
 for(const path of ['overview','sales','clients','customers','expenses','activity','users','odoo/status']){await request(path);console.log(`PASS ${path}`);}
 if(process.argv.includes('--expense')){
  const path='backups/live-smoke-expense.json';
  const expense=fs.existsSync(path)?JSON.parse(fs.readFileSync(path,'utf8')):{request_id:crypto.randomUUID(),amount_cents:1,currency:'USD',details:'اختبار تقني للمزامنة — 0.01 USD تجريبي وليس مصروفاً فعلياً',paid_on:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Damascus',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())};
  fs.writeFileSync(path,JSON.stringify(expense));await request('expenses',expense);await request('expenses',expense);
  const expenses=await request('expenses');assert.equal(expenses.items.filter(e=>e.request_id===expense.request_id).length,1);
  console.log('PASS live expense and duplicate retry');
 }
 await request('odoo/retry',{});
 for(let i=0;i<6;i++){
  const status=await request('odoo/status');console.log(JSON.stringify(status));
  if(status.enabled&&status.pending===0)break;
  if(status.first?.error)throw Error(status.first.error);
  if(i===5)throw Error('Delivery still pending');
  await new Promise(resolve=>setTimeout(resolve,10000));
 }
}finally{
 await request('auth/logout',{});
 assert.equal((await fetch(base+'/api/overview',{headers:{Cookie:cookie}})).status,401);
 console.log('PASS logout invalidates session');
}
