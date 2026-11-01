// One-way, complete business-data mirror. This does not post accounting documents.
const kinds={stock_history:'تاريخ أرصدة المخزون',products:'الأجهزة',warehouses:'المستودعات والعهد',technicians:'الفنيون',warehouse_technicians:'ارتباط الفني بالمستودع',stock:'أرصدة المخزون',sales:'المبيعات',movements:'حركات المخزون',stock_transfers:'التحويلات',client_directory:'دليل العملاء',product_images:'صور الأجهزة',expenses:'المصاريف',users:'الموظفون',activity:'سجل المسؤولية'};
const labels={id:'الرقم',name:'الاسم',customer:'العميل',phone:'الهاتف',address:'العنوان',quantity:'الكمية',delta:'تغير الكمية',price_cents:'سعر الوحدة (سنت أمريكي)',amount_cents:'المبلغ بأصغر وحدة للعملة',currency:'العملة',details:'التفاصيل',notes:'ملاحظات',note:'ملاحظة الحركة',sold_on:'تاريخ البيع',paid_on:'تاريخ الدفع',created_at:'تاريخ الإنشاء UTC',cancelled_at:'تاريخ الإلغاء UTC',product_id:'رقم الجهاز',warehouse_id:'رقم موقع المخزون',technician_id:'رقم الفني',from_warehouse_id:'من الموقع',to_warehouse_id:'إلى الموقع',custody_owner_id:'صاحب العهدة',custody_warehouse_id:'موقع العهدة',stock_warehouse_id:'موقع المخزون المشترك',username:'اسم المستخدم',active:'فعّال',role:'الدور',path:'العملية',actor_id:'رقم الموظف',created_by:'رقم الموظف',source:'المصدر',installation_fee_cents:'أجور التركيب (سنت أمريكي)',shipping_fee_cents:'أجور الشحن (سنت أمريكي)',sim_code:'رمز الشريحة',revision:'رقم النسخة',request_id:'مرجع العملية',governorate:'المحافظة',category:'تصنيف العميل',sku:'رمز الجهاز',kind:'نوع الحركة',sale_id:'رقم المبيع'};
const actions={baseline:'بيانات سابقة',insert:'إضافة',update:'تعديل',delete:'حذف'};
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>Math.floor(Date.now()/1000);
export function configured(env){return env.ODOO_ENABLED==='true'&&!!env.ODOO_API_KEY&&!!env.ODOO_URL&&Number(env.ODOO_COMPANY_ID)>0;}
export function exportRow(row,instance,env,event=false){
 const data=JSON.parse(row.payload),reference=`${row.entity}:${row.record_key}`;
 const safeKey=Array.from(new TextEncoder().encode(reference),x=>x.toString(16).padStart(2,'0')).join('');
 const external=`x_madar_sync.${instance}_${event?'event_'+row.id:'record_'+safeKey}`;
 const title=`${kinds[row.entity]||row.entity} · ${data.name||data.customer||data.details?.slice?.(0,70)||row.record_key}`;
 const detail=`<div dir="rtl"><p>نسخة تلقائية من مدار — جميع التعديلات تتم في مدار.</p><table class="table table-bordered"><tbody>${Object.entries(data).filter(([key])=>!['request_id','revision'].includes(key)).map(([key,value])=>`<tr><th>${escape((labels[key]||key).replace(' (سنت أمريكي)','').replace(' بأصغر وحدة للعملة',''))}</th><td>${key==='data_url'?(typeof value==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value)?`<img src="${value}" style="max-width:320px"/>`:'صورة غير متاحة'):escape(key.endsWith('_cents')&&typeof value==='number'?`${(value/100).toFixed(2)} ${data.currency||'USD'}`:typeof value==='object'?JSON.stringify(value):value)}</td></tr>`).join('')}</tbody></table></div>`;
 return [external,title,kinds[row.entity]||row.entity,reference,env.ODOO_SOURCE||'مدار',row.actor||'نظام',actions[row.action]||row.action,row.created_at,row.action==='delete'?'True':'False',String(env.ODOO_COMPANY_ID),row.payload,detail];
}
const fields=['id','x_name','x_kind','x_reference','x_source','x_actor','x_action','x_changed_at','x_deleted','x_company_id/.id','x_payload','x_details'];
async function send(env,model,data){
 const url=new URL(env.ODOO_URL);
 if(url.protocol!=='https:'||url.username||url.password)throw Error('invalid_odoo_url');
 const response=await fetch(`${url.origin}/json/2/${model}/load`,{method:'POST',headers:{Authorization:`bearer ${env.ODOO_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({fields,data,context:{allowed_company_ids:[Number(env.ODOO_COMPANY_ID)],lang:'en_US'}}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(`odoo_http_${response.status}`);
 const result=await response.json();
 // Never include remote error bodies (which can contain business data) in logs/status.
 if(!Array.isArray(result.ids)||result.ids.length!==data.length||result.messages?.some(m=>m.type==='error'))throw Error('odoo_import_rejected');
}
export async function drainOdoo(env){
 if(!configured(env))return {disabled:true};
 const db=env.DB,token=crypto.randomUUID(),started=Date.now();
 const lock=await db.prepare('UPDATE odoo_state SET lease_token=?,lease_until=? WHERE id=1 AND lease_until<? RETURNING instance').bind(token,now()+180,now()).first();
 if(!lock)return {busy:true};
 let delivered=0;
 try{
  // A bounded pass prevents a Worker request from monopolizing the queue.
  for(let pass=0;pass<4&&Date.now()-started<45000;pass++){
   const rows=(await db.prepare('SELECT * FROM odoo_outbox WHERE delivered_at IS NULL ORDER BY id LIMIT 20').all()).results;
   if(!rows.length||rows[0].next_attempt>now())break;
   const latest=new Map();for(const row of rows)latest.set(row.entity+':'+row.record_key,row);
   try{
    await send(env,'x_madar_record',[...latest.values()].map(row=>exportRow(row,lock.instance,env)));
    await send(env,'x_madar_event',rows.map(row=>exportRow(row,lock.instance,env,true)));
    await db.batch([db.prepare(`UPDATE odoo_outbox SET delivered_at=datetime('now'),error=NULL WHERE id IN (${rows.map(()=>'?').join(',')})`).bind(...rows.map(r=>r.id)),db.prepare("UPDATE odoo_state SET last_success=datetime('now') WHERE id=1 AND lease_token=?").bind(token)]);
    delivered+=rows.length;
   }catch(error){
    const code=/^odoo_(http_\d+|import_rejected)$/.test(error.message)?error.message:'odoo_connection_failed';
    await db.prepare('UPDATE odoo_outbox SET attempts=attempts+1,next_attempt=?,error=? WHERE id=?').bind(now()+Math.min(900,30*2**Math.min(rows[0].attempts,5)),code,rows[0].id).run();
    return {delivered,error:code};
   }
  }
  return {delivered};
 }finally{await db.prepare('UPDATE odoo_state SET lease_token=NULL,lease_until=0 WHERE id=1 AND lease_token=?').bind(token).run();}
}
export async function odooApi(req,env,user,ctx){
 const path=new URL(req.url).pathname;
 if(!path.startsWith('/api/odoo/'))return null;
 if(user.role!=='admin')throw Object.assign(Error('forbidden'),{status:403});
 const db=env.DB;
 if(path==='/api/odoo/retry'&&req.method==='POST'){
  await db.prepare('UPDATE odoo_outbox SET next_attempt=0 WHERE delivered_at IS NULL AND error IS NOT NULL').run();
  if(ctx)ctx.waitUntil(drainOdoo(env));
  return Response.json({ok:true});
 }
 if(path==='/api/odoo/status'&&req.method==='GET'){
  const counts=await db.prepare('SELECT COUNT(*) total,SUM(delivered_at IS NULL) pending,SUM(delivered_at IS NOT NULL) delivered FROM odoo_outbox').first();
  const status=await db.prepare('SELECT last_success,lease_until FROM odoo_state WHERE id=1').first();
  const first=await db.prepare('SELECT entity,record_key,attempts,error,next_attempt FROM odoo_outbox WHERE delivered_at IS NULL ORDER BY id LIMIT 1').first();
  return Response.json({enabled:configured(env),...counts,...status,first,destination:env.ODOO_URL||null});
 }
 throw Object.assign(Error('not_found'),{status:404});
}
