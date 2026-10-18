import {useState} from 'react';
import DataTable,{displayValue,Pagination} from './DataTable.jsx';
import {label} from '../config/modules.js';
import {tableRows,downloadExcel,printTable} from '../utils/table-export.js';
import {Notice} from './Feedback.jsx';
export default function ReportTable({rows,columns,references,title='Reporte',context='',...props}){
 const [filterOpen,setFilterOpen]=useState(false);
 const [search,setSearch]=useState(''),[filters,setFilters]=useState({}),[sort,setSort]=useState({}),[page,setPage]=useState(1),[limit,setLimit]=useState(25),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const format=(key,value,row)=>displayValue(key,value,references,row);const visible=tableRows(rows,columns,format,search,filters,sort);const current=Math.min(page,Math.max(1,Math.ceil(visible.length/limit)));
 const description=[context,'Registros filtrados: '+visible.length,search?'Búsqueda: '+search:'',...Object.entries(filters).filter(([,value])=>value).map(([key,value])=>label(key)+': '+value),sort.key?'Orden: '+label(sort.key)+' '+sort.direction:''].filter(Boolean).join(' | ');
 async function excel(){setError('');setBusy(true);try{await downloadExcel(title.replace(/[^\p{L}\p{N}-]/gu,'_')+'.xlsx',visible,columns,format,title,description);}catch{setError('No se pudo generar Excel. Intenta nuevamente.');}finally{setBusy(false);}}
 return <div className="report-table"><Notice>{error}</Notice><div className="table-toolbar"><label>Buscar en toda la tabla<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label><div className="toolbar-controls"><button className="button secondary" disabled={busy||!visible.length} onClick={excel}>{busy?'Generando…':'Exportar Excel (.xlsx)'}</button><button className="button secondary" disabled={!visible.length} onClick={()=>{try{printTable(visible,columns,format,title,description);}catch(e){setError(e.message);}}}>Imprimir / PDF</button></div></div>
 <details className="filter-panel" onToggle={e=>setFilterOpen(e.currentTarget.open)}><summary>Filtros por columna</summary>{filterOpen&&<div className="filter-grid">{columns.map(key=><label key={key}>{label(key)}<input value={filters[key]||''} onChange={e=>{setFilters(old=>({...old,[key]:e.target.value}));setPage(1);}}/></label>)}</div>}</details>
 <div className="table-toolbar"><label>Filas por página<select value={limit} onChange={e=>{setLimit(Number(e.target.value));setPage(1);}}>{[10,25,50,100].map(value=><option key={value}>{value}</option>)}</select></label><span>{visible.length} de {rows.length} registros</span><button className="button subtle" onClick={()=>{setSearch('');setFilters({});setSort({});setPage(1);}}>Limpiar búsqueda y filtros</button></div>
 <DataTable {...props} rows={visible.slice((current-1)*limit,current*limit)} columns={columns} references={references} sort={sort} onSort={key=>{setSort(old=>({key,direction:old.key===key&&old.direction==='asc'?'desc':'asc'}));setPage(1);}}/>
 <Pagination page={current} limit={limit} total={visible.length} onChange={setPage}/><p className="report-note">Excel e impresión incluyen todos los resultados filtrados, en el orden seleccionado. Para PDF, selecciona Guardar como PDF en la ventana de impresión.</p></div>;
}
