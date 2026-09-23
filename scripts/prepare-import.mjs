import {readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const [input,output]=process.argv.slice(2);
if(!input||!output||input===output)throw new Error('Provide distinct input and output SQL paths.');
const source=readFileSync(input,'utf8');
// D1 exports tables with their data; sales can reference tables exported later.
// Create every table before inserting rows; preserve triggers at the end.
const tables=[...source.matchAll(/^CREATE TABLE[\s\S]*?;\r?$/gm)].map(x=>x[0]);
if(!tables.length)throw new Error('No exported table definitions found.');
const sql='PRAGMA defer_foreign_keys=TRUE;\n'+tables.join('\n')+'\n'+source.replace(/^CREATE TABLE[\s\S]*?;\r?$/gm,'');
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON; BEGIN;');db.exec(sql);db.exec('COMMIT;');
if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Foreign key validation failed.');
const summary={};for(const table of ['products','warehouses','stock','sales','technicians','product_images','d1_migrations'])summary[table]=db.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count;
// Remote D1 may split the file into transactions; order rows by dependencies.
const order=['d1_migrations','products','warehouses','technicians','stock','sales','movements','login_attempts','warehouse_technicians','product_images'];
const quote=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
const statements=[...tables];
for(const table of order){for(const row of db.prepare(`SELECT * FROM ${table}`).all())statements.push(`INSERT INTO "${table}" (${Object.keys(row).map(k=>'"'+k+'"').join(',')}) VALUES (${Object.values(row).map(quote).join(',')});`);}
for(const row of db.prepare("SELECT sql FROM sqlite_master WHERE type IN ('index','trigger') AND sql IS NOT NULL ORDER BY type,name").all())statements.push(row.sql+';');
const finalSql=statements.join('\n');
const verify=new DatabaseSync(':memory:');verify.exec('PRAGMA foreign_keys=ON');verify.exec(finalSql);verify.close();
writeFileSync(output,finalSql,{flag:'wx'});console.log('Validated import for an EMPTY database:',summary);db.close();
