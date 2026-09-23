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
writeFileSync(output,sql,{flag:'wx'});console.log('Validated import for an EMPTY database:',summary);db.close();
