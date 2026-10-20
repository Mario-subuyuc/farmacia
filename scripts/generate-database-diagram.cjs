const fs = require('node:fs');
const path = require('node:path');

// Uso: node scripts/generate-database-diagram.cjs <ruta al paquete @viz-js/viz>
async function main() {
  const { instance } = require(process.argv[2] || '@viz-js/viz');
  const viz = await instance();
  const root = path.resolve(__dirname, '..');
  const data = JSON.parse(fs.readFileSync(path.join(root, 'docs/documentacion/modelo-datos.json'), 'utf8'));
  const out = path.join(root, 'docs/documentacion/diagrama-bd');
  fs.mkdirSync(out, { recursive: true });
  const key = (s, t) => `${s}.${t}`;
  const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const tables = data.tables.map(t => key(t.table_schema, t.table_name));
  const cols = t => data.columns.filter(c => key(c.table_schema, c.table_name) === t);
  const constraints = t => data.constraints.filter(c => key(c.schema, c.table_name) === t);
  const fields = c => (c.definition.match(/\(([^)]+)\)/)?.[1] || '').split(',').map(x => x.trim());
  const pk = t => constraints(t).filter(c => c.contype === 'p').flatMap(fields);
  const singleUnique = (t, col) => constraints(t).some(c => ['p', 'u'].includes(c.contype) && fields(c).length === 1 && fields(c)[0] === col);
  const fks = t => data.foreignKeys.filter(f => key(f.source_schema, f.source_table) === t);
  const groups = [
    ['Inventario y traslados', ['sucursales','medicamentos','proveedores','inventario','stock_minimos','alertas_inventario','traslados','detalle_traslado','movimientos_medicamentos','solicitudes_stock']],
    ['Clientes, pedidos y ventas', ['clientes','pedidos','detalle_pedido','reservas_pedido','ventas','detalle_venta','devoluciones_clientes','notificaciones','privado.pedidos_portal']],
    ['Compras, caja y personal', ['compras','detalle_compra','empleados','planillas','detalle_planilla','movimientos_caja','cierres_caja','activos']],
    ['Acceso, eventos y soporte', ['perfiles','permisos_operativos','eventos','inscripciones','plantillas_correo','contenidos','cupones','auditoria','privado.correos_eventos','privado.solicitudes','privado.operaciones_farmacia']]
  ].map(([name, names]) => [name, names.map(n => n.includes('.') ? n : `public.${n}`)]);
  const colors = ['#dcefe9','#e1ebfa','#fdf0d9','#ece6f7'];
  const groupIndex = t => groups.findIndex(([, ts]) => ts.includes(t));
  function node(t, full = false, external = false) {
    const cs = t === 'auth.users' ? [{column_name:'id',udt_name:'uuid',is_nullable:'NO'}] : cols(t);
    const ps = t === 'auth.users' ? ['id'] : pk(t);
    const foreign = fks(t).map(f => f.source_column);
    const shown = full ? cs : cs.filter(c => ps.includes(c.column_name) || foreign.includes(c.column_name));
    const rows = shown.map(c => `<TR><TD ALIGN="LEFT">${ps.includes(c.column_name)?'PK ':''}${foreign.includes(c.column_name)?'FK ':''}${esc(c.column_name)}</TD><TD ALIGN="LEFT">${esc(c.udt_name)}${c.is_nullable === 'YES' ? ' ?' : ''}</TD></TR>`).join('');
    return `${JSON.stringify(t)} [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="6"><TR><TD COLSPAN="2" BGCOLOR="${external?'#edf0f4':colors[groupIndex(t)] || '#edf0f4'}"><B>${esc(t)}</B>${external?' (referencia)':''}</TD></TR>${rows || '<TR><TD COLSPAN="2">Sin claves declaradas</TD></TR>'}</TABLE>>];`;
  }
  function graph(owned, full, general = false) {
    const rels = general ? data.foreignKeys : data.foreignKeys.filter(f => owned.includes(key(f.source_schema,f.source_table)));
    const all = new Set(owned);
    rels.forEach(f => all.add(key(f.target_schema,f.target_table)));
    const lines = ['digraph BD { graph [rankdir=LR,bgcolor="white",pad="0.5",nodesep="0.45",ranksep="1.25",splines=polyline,outputorder=edgesfirst]; node [shape=plain,fontname="Arial",fontsize=11]; edge [fontname="Arial",fontsize=9,color="#718397",arrowsize=0.65];'];
    if (general) groups.forEach(([name, ts], i) => {lines.push(`subgraph cluster_${i} { label=${JSON.stringify(name)}; fontname="Arial"; fontsize=18; color="${colors[i]}"; style="rounded";`); ts.forEach(t => lines.push(node(t)));lines.push('}');});
    else owned.forEach(t => lines.push(node(t, full)));
    [...all].filter(t => !owned.includes(t)).forEach(t => lines.push(node(t, false, true)));
    rels.forEach(f => {
      const source = key(f.source_schema,f.source_table), target = key(f.target_schema,f.target_table);
      const col = cols(source).find(c => c.column_name === f.source_column);
      const parent = col?.is_nullable === 'YES' ? '0..1' : '1';
      const child = singleUnique(source,f.source_column) ? '0..1' : '0..N';
      lines.push(`${JSON.stringify(target)} -> ${JSON.stringify(source)} [label=${JSON.stringify(f.source_column)},taillabel="${parent}",headlabel="${child}",labeldistance=2];`);
    });
    return lines.join('\n') + '\n}';
  }
  const views = [['Vista general', tables, false], ...groups.map(([n,ts])=>[n,ts,true])];
  const sections = views.map(([name, ts, full], i) => {
    const dot = graph(ts,full,i===0);
    fs.writeFileSync(path.join(out,`${i}-diagrama.dot`),dot);
    const svg = viz.renderString(dot,{format:'svg'});
    fs.writeFileSync(path.join(out,`${i}-diagrama.svg`),svg);
    return `<section id="vista-${i}"><h2>${esc(name)}</h2><p>${i===0?'Todas las tablas y relaciones; se muestran PK y FK.':'Campos completos de las tablas del módulo. Las tablas de referencia muestran sus claves.'}</p><div class="canvas">${svg.replace(/<\?xml[^>]*>|<!DOCTYPE[\s\S]*?\]?>/g,'')}</div></section>`;
  });
  const relationRows = data.foreignKeys.map(f => `<tr><td>${esc(key(f.source_schema,f.source_table))}.${esc(f.source_column)}</td><td>${esc(key(f.target_schema,f.target_table))}.${esc(f.target_column)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>NexoFarma · Diagrama de base de datos</title><style>body{font:15px system-ui;margin:0;background:#f3f6fa;color:#172c3b}header,main{padding:28px;max-width:1800px;margin:auto}header{background:#163e35;color:white;max-width:none}h1{margin:0 0 12px}nav{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}a{color:#216b58}nav a{padding:10px;background:white;border-radius:6px}section{background:white;border:1px solid #dce3eb;border-radius:12px;padding:22px;margin:22px 0}.canvas{overflow:auto;max-height:80vh;border:1px solid #e2e8ee;background:white}.canvas svg{display:block}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:9px;border-bottom:1px solid #dce3eb;text-align:left}button{cursor:pointer;padding:8px 14px}@media print{.canvas{max-height:none;overflow:visible}.canvas svg{width:100%;height:auto}section{break-before:page}nav,button{display:none}}</style><header><h1>NexoFarma · Modelo de base de datos</h1><div>38 tablas del proyecto · 69 claves foráneas · auth.users como identidad externa</div></header><main><p>Fuente: <code>docs/documentacion/modelo-datos.json</code>, consistente con las tablas declaradas en las migraciones 001–017. Representa el esquema documentado en el repositorio; no es una consulta en vivo.</p><p><b>PK</b>: clave primaria · <b>FK</b>: clave foránea · <b>?</b>: campo que admite NULL · <b>1</b>: exactamente uno · <b>0..1</b>: opcional, como máximo uno · <b>0..N</b>: cero o muchos. Las flechas van de la tabla referenciada a la tabla que contiene la FK. Las claves compuestas se marcan en cada campo participante.</p><p>Desplázate dentro de cada diagrama para leerlo a tamaño completo. El zoom del navegador permite ampliar. Las tablas sin conexiones no tienen FK declaradas; no se infieren relaciones por el nombre de sus campos.</p><nav>${views.map(([n],i)=>`<a href="#vista-${i}">${esc(n)}</a>`).join('')}<a href="#relaciones">Lista de relaciones</a></nav>${sections.join('')}<section id="relaciones"><h2>Las 69 relaciones declaradas</h2><table><thead><tr><th>Campo FK</th><th>Campo referenciado</th></tr></thead><tbody>${relationRows}</tbody></table></section></main></html>`;
  fs.writeFileSync(path.join(out,'NexoFarma_Diagrama_BD.html'),html);
  console.log(`Generados ${views.length} diagramas SVG y documento HTML en ${out}`);
}
main().catch(e => {console.error(e);process.exitCode=1;});
