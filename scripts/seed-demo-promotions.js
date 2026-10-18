import { databaseClient, databaseFailure } from './database.js';
let db;
try {
 db=await databaseClient();
 const result=await db.query(`update medicamentos m set descuento_porcentaje=v.porcentaje,
  promocion_titulo='Especial de bienestar',promocion_desde=(now() at time zone 'America/Guatemala')::date,
  promocion_hasta=(now() at time zone 'America/Guatemala')::date+30
  from (values ('DEMO-PARA',15),('DEMO-LORA',10),('DEMO-VITC',20)) v(codigo,porcentaje)
  where m.codigo=v.codigo and m.descuento_porcentaje=0 returning m.nombre,m.descuento_porcentaje`);
 for(const row of result.rows)console.log('Promoción DEMO:',row.nombre,Number(row.descuento_porcentaje)+'%');
 console.log('Solo se completan productos DEMO sin descuento.');
}catch(error){console.error(databaseFailure(error));process.exitCode=1;}finally{await db?.end();}
