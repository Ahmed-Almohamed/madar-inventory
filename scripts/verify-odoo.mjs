// Read-only reconciliation. Never prints customer data or credentials.
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {call} from './odoo-client.mjs';
const sql='SELECT entity,record_key,payload,action,delivered_at FROM odoo_outbox WHERE id IN (SELECT MAX(id) FROM odoo_outbox GROUP BY entity,record_key)';
const result=JSON.parse(execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--remote','--command',sql,'--json'],{encoding:'utf8',maxBuffer:20*1024*1024}));
const source=result[0].results;
const records=await call('x_madar_record','search_read',{domain:[['x_source','=','مدار — الموقع']],fields:['x_reference','x_payload','x_deleted','x_company_id'],limit:100000,context:{allowed_company_ids:[3]}});
assert.equal(records.length,source.length,'Record counts match');
for(const row of source){
 assert.ok(row.delivered_at,'Pending change must be delivered before verification');
 const matches=records.filter(r=>r.x_reference===row.entity+':'+row.record_key);assert.equal(matches.length,1,'Unique record reference');
 assert.deepEqual(JSON.parse(matches[0].x_payload),JSON.parse(row.payload),'Complete payload matches');
 assert.equal(matches[0].x_company_id[0],3);assert.equal(matches[0].x_deleted,row.action==='delete');
}
console.log(`PASS: ${source.length} complete records match Odoo exactly, including images, original amounts and deletion state.`);
