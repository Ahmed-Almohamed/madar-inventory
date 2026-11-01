import {readFileSync} from 'node:fs';
const url=process.env.ODOO_URL||'https://birq.odoo.com';
const key=process.env.ODOO_API_KEY||readFileSync('backups/odoo-key.txt','utf8').trim();
export async function call(model,method,args={}){
 const response=await fetch(`${url}/json/2/${model}/${method}`,{method:'POST',headers:{Authorization:`bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(45000)});
 const result=await response.json();
 if(!response.ok)throw new Error(`${model}.${method}: ${response.status} ${result.message||result.error?.message||JSON.stringify(result).slice(0,1500)}`);
 return result;
}
