export function csv(rows){
 return '\ufeff'+rows.map(row=>row.map(value=>{
  let s=String(value??'');
  if(/^[\s]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
 }).join(',')).join('\r\n');
}
