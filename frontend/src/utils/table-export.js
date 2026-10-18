import {label} from '../config/modules.js';
const numericFields=new Set('costo pagado reembolso esperado contado diferencia total monto salario valor valor_residual precio_compra precio_venta costo_unitario precio_unitario subtotal neto salario_base bonificacion deduccion valor_compra saldo_inicial ingresos egresos saldo_periodo saldo_final valor_adquisicion valor_contable_estimado cantidad cantidad_registrada reservado disponible vencido stock_minimo cupo recordatorio_horas recibido'.split(' '));
export function normalize(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
export function tableRows(rows,columns,format,search='',filters={},sort={}){
 const terms=normalize(search).split(/\s+/).filter(Boolean);
 const filtered=rows.filter(row=>{const text=columns.map(key=>normalize(format(key,row[key],row))).join(' ');return terms.every(term=>text.includes(term))&&columns.every(key=>!filters[key]||normalize(format(key,row[key],row)).includes(normalize(filters[key])));});
 if(!sort.key)return filtered;
 return [...filtered].sort((a,b)=>{const x=a[sort.key],y=b[sort.key];const numeric=!sort.key.startsWith('id_')&&x!==null&&y!==null&&/^-?\d+(\.\d+)?$/.test(String(x))&&/^-?\d+(\.\d+)?$/.test(String(y));const dates=/^\d{4}-\d{2}-\d{2}/.test(String(x))&&/^\d{4}-\d{2}-\d{2}/.test(String(y));const result=numeric?Number(x)-Number(y):dates?String(x).localeCompare(String(y)):String(format(sort.key,x,a)).localeCompare(String(format(sort.key,y,b)),'es',{numeric:true,sensitivity:'base'});return sort.direction==='desc'?-result:result;});
}
export async function excelBuffer(rows,columns,format,title,context=''){
 const {default:ExcelJS}=await import('exceljs');const book=new ExcelJS.Workbook();book.creator='NexoFarma';const sheet=book.addWorksheet('Reporte');
 sheet.addRow([title]);sheet.addRow([context]);sheet.addRow(columns.map(label));
 rows.forEach(row=>sheet.addRow(columns.map(key=>!key.startsWith('id_')&&(typeof row[key]==='number'||numericFields.has(key))&&row[key]!==null&&row[key]!==''&&/^-?\d+(\.\d+)?$/.test(String(row[key]))?Number(row[key]):String(format(key,row[key],row)))));
 sheet.getRow(1).font={bold:true,size:16};sheet.getRow(3).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(3).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17685D'}};
 sheet.columns.forEach(col=>{col.width=25;});sheet.views=[{state:'frozen',ySplit:3}];sheet.autoFilter={from:{row:3,column:1},to:{row:3,column:columns.length}};
 return book.xlsx.writeBuffer();
}
export async function downloadExcel(name,...args){const buffer=await excelBuffer(...args);const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function printTable(rows,columns,format,title,context){
 const popup=window.open('','_blank');if(!popup)throw Error('Permite las ventanas emergentes para imprimir.');
 const doc=popup.document;doc.title=title;const style=doc.createElement('style');style.textContent='body{font:12px Arial;color:#183c35;padding:20px}table{border-collapse:collapse;width:100%}th,td{padding:8px;border:1px solid #ccc;text-align:left}th{background:#eaf3ed}thead{display:table-header-group}tr{break-inside:avoid}@page{size:landscape;margin:12mm}';doc.head.append(style);
 const heading=doc.createElement('h1');heading.textContent=title;doc.body.append(heading);const info=doc.createElement('p');info.textContent=context;doc.body.append(info);const table=doc.createElement('table');const head=table.createTHead().insertRow();columns.forEach(key=>{const cell=doc.createElement('th');cell.textContent=label(key);head.append(cell);});const body=table.createTBody();rows.forEach(row=>{const tr=body.insertRow();columns.forEach(key=>{tr.insertCell().textContent=format(key,row[key],row);});});doc.body.append(table);popup.opener=null;popup.focus();popup.print();
}
