import Modal from './Modal.jsx';
import DataTable, { displayValue, Pagination } from './DataTable.jsx';
import { Loading, Notice } from './Feedback.jsx';
import { useRecords } from '../hooks/useRecords.js';
import { label } from '../config/modules.js';
import { useState } from 'react';

function Details({ client, path, references }) {
  const [page, setPage] = useState(1);
  const state = useRecords(client, path, { page, limit: 25 });
  const columns = state.rows[0] ? Object.keys(state.rows[0]).filter(key => !['id_detalle', 'id_venta', 'id_pedido', 'id_planilla', 'id_traslado'].includes(key)) : [];
  return <section className="detail-lines"><h3>Detalle de la operación</h3><Notice>{state.error}</Notice>
    {state.loading ? <Loading /> : <DataTable rows={state.rows} columns={columns} rowKey="id_detalle" references={references} />}
    <Pagination page={page} total={state.total} onChange={setPage} loading={state.loading} /></section>;
}

export default function RecordDetail({ record, module, references, client, onClose }) {
  const [receiptError,setReceiptError]=useState('');
  async function downloadReceipt(){try{
    const result=await client.get('/ventas/'+record.id_venta+'/detalles',{limit:100});
    const lines=['NEXOFARMA - COMPROBANTE INTERNO','Venta #'+record.id_venta,...Object.entries(record).filter(([key])=>!['creado_por','receta_referencia'].includes(key)).map(([key,value])=>label(key)+': '+displayValue(key,value,references,record)),'',...result.data.map(item=>displayValue('id_medicamento',item.id_medicamento,references)+' | '+item.cantidad+' x '+displayValue('precio_unitario',item.precio_unitario,references)),'','Documento interno de operacion. No es factura fiscal.'];
    const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='comprobante-venta-'+record.id_venta+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){setReceiptError(error.message);}}

  return <Modal title={`${module.singular[0].toUpperCase()}${module.singular.slice(1)} · ${record[module.id]}`} onClose={onClose} wide>
    <dl className="record-detail">{Object.entries(record).filter(([key]) => !['antes', 'despues'].includes(key)).map(([key, value]) =>
      <div key={key}><dt>{label(key)}</dt><dd>{displayValue(key, value, references, record)}</dd></div>)}</dl>
    {module.path === 'auditoria' && <div className="audit-diff">{['antes', 'despues'].map(key => <section key={key}><h3>{key === 'antes' ? 'Valor anterior' : 'Valor actual'}</h3>
      {record[key] ? <dl>{Object.entries(record[key]).map(([name, value]) => <div key={name}><dt>{label(name)}</dt><dd>{displayValue(name, value, references)}</dd></div>)}</dl> : <p className="muted">Sin registro {key === 'antes' ? 'anterior' : 'posterior'}.</p>}</section>)}</div>}
    {module.details && <Details client={client} path={`/${module.path}/${record[module.id]}/detalles`} references={references} />}
    <Notice>{receiptError}</Notice><div className="form-footer">{module.path==='ventas'&&<button className="button secondary" onClick={downloadReceipt}>Descargar comprobante interno</button>}<button className="button secondary" onClick={onClose}>Cerrar</button></div>
  </Modal>;
}
