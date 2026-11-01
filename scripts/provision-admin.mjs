import {mkdir,writeFile} from 'node:fs/promises';
import {hashPassword} from '../src/accounts.js';
let input='';for await(const chunk of process.stdin)input+=chunk;const data=JSON.parse(input);
if(typeof data.password!=='string'||data.password.length<10)throw new Error('Password must have at least 10 characters');
const username=String(data.username||'').trim().toLowerCase();if(!/^[a-z0-9._-]{3,60}$/.test(username))throw new Error('Invalid username');
const hash=await hashPassword(data.password);await mkdir(new URL('../backups/',import.meta.url),{recursive:true});
await writeFile(new URL('../backups/admin-bootstrap.sql',import.meta.url),`INSERT INTO users(username,name,password_hash,role) VALUES('${username}','${username}','${hash}','admin') ON CONFLICT(username) DO NOTHING;\n`,{mode:0o600});console.log('Prepared initial admin insert in ignored backups directory; existing accounts are not overwritten.');
