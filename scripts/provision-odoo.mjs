// Odoo 20: additive setup, scoped to the Madar models. Never modifies accounting.
import {call} from './odoo-client.mjs';
if(!process.argv.includes('--apply'))throw Error('Pass --apply to create/update the Madar mirror screens.');
async function ensure(model,domain,values){
 const rows=await call(model,'search_read',{domain,fields:['id'],limit:2});
 if(rows.length>1)throw Error(`Ambiguous setup record: ${model}`);
 if(rows.length){await call(model,'write',{ids:[rows[0].id],vals:values});return rows[0].id;}
 return (await call(model,'create',{vals_list:[values]}))[0];
}
const admin=(await call('ir.model.data','search_read',{domain:[['module','=','base'],['name','=','group_system']],fields:['res_id']}))[0].res_id;
const root=await ensure('ir.ui.menu',[['name','=','مدار — سوريا'],['parent_id','=',false]],{name:'مدار — سوريا',sequence:5,group_ids:[[6,0,[admin]]]});
for(const [model,label,sequence] of [['x_madar_record','بيانات مدار',10],['x_madar_event','سجل التغييرات',20]]){
 const id=await ensure('ir.model',[['model','=',model]],{name:label,model,state:'manual'});
 const existing=await call('ir.model.fields','search_read',{domain:[['model_id','=',id]],fields:['name']});
 const definitions=[['x_name','العنوان','char'],['x_kind','القسم','char'],['x_reference','مرجع مدار','char'],['x_source','المصدر','char'],['x_actor','الموظف المسؤول','char'],['x_action','العملية','char'],['x_changed_at','وقت العملية UTC','datetime'],['x_deleted','محذوف في مدار','boolean'],['x_company_id','الفرع','many2one',{relation:'res.company',required:true,on_delete:'restrict'}],['x_payload','البيانات الكاملة JSON','text'],['x_details','التفاصيل','html']];
 for(const [name,description,type,extra={}] of definitions){
  if(!existing.some(f=>f.name===name))await call('ir.model.fields','create',{vals_list:[{name,field_description:description,ttype:type,model_id:id,state:'manual',...extra}]});
 }
 await ensure('ir.access',[['name','=',model+'_admin']],{name:model+'_admin',model_id:id,group_id:admin,operation:'cru',kind:'permission',domain:"[('x_company_id', 'in', company_ids)]"});
 const list=await ensure('ir.ui.view',[['name','=',model+'.list']],{name:model+'.list',model,type:'list',arch_db:`<list create="0" edit="0" delete="0" default_order="x_changed_at desc,id desc"><field name="x_name"/><field name="x_kind"/><field name="x_actor"/><field name="x_action"/><field name="x_changed_at"/><field name="x_source" optional="hide"/><field name="x_reference" optional="hide"/><field name="x_deleted" optional="hide"/><field name="x_company_id" optional="hide"/></list>`});
 await ensure('ir.ui.view',[['name','=',model+'.form']],{name:model+'.form',model,type:'form',arch_db:`<form create="0" edit="0" delete="0"><sheet><h1><field name="x_name"/></h1><group><group><field name="x_kind"/><field name="x_actor"/><field name="x_action"/><field name="x_changed_at"/></group><group><field name="x_company_id"/><field name="x_reference"/><field name="x_source"/><field name="x_deleted"/></group></group><notebook><page string="التفاصيل"><field name="x_details"/></page><page string="البيانات الكاملة"><field name="x_payload"/></page></notebook></sheet></form>`});
 const search=await ensure('ir.ui.view',[['name','=',model+'.search']],{name:model+'.search',model,type:'search',arch_db:`<search><field name="x_name"/><field name="x_kind"/><field name="x_actor"/><field name="x_reference"/><filter name="group_kind" string="حسب القسم" context="{'group_by':'x_kind'}"/><filter name="group_actor" string="حسب الموظف" context="{'group_by':'x_actor'}"/><filter name="group_source" string="حسب المصدر" context="{'group_by':'x_source'}"/></search>`});
 const action=await ensure('ir.actions.act_window',[['res_model','=',model],['name','=',label]],{name:label,res_model:model,view_mode:'list,form',view_id:list,search_view_id:search,domain:"[('x_company_id', '=', 3)]",context:"{'allowed_company_ids':[3], 'default_x_company_id':3, 'search_default_group_kind':1}"});
 await ensure('ir.ui.menu',[['parent_id','=',root],['name','=',label]],{name:label,parent_id:root,sequence,action:`ir.actions.act_window,${action}`,group_ids:[[6,0,[admin]]]});
 console.log(JSON.stringify({model,action,url:`https://birq.odoo.com/odoo/action-${action}`}));
}
