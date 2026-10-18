import { useState } from 'react';
import { Eye, Pencil, Plus, RefreshCw } from 'lucide-react';
import { can, label, modules } from '../config/modules.js';
import { newOperation, recordActions } from '../config/operations.js';
import { useRecords } from '../hooks/useRecords.js';
import ReportTable from '../components/ReportTable.jsx';
import { Loading, Notice } from '../components/Feedback.jsx';
import RecordForm from '../components/RecordForm.jsx';
import OperationForm from '../components/OperationForm.jsx';
import RecordDetail from '../components/RecordDetail.jsx';
import PrescriptionPreview from '../components/PrescriptionPreview.jsx';
import CatalogImageForm from '../components/CatalogImageForm.jsx';
import Field from '../components/Field.jsx';

export default function ModulePage({ name, client, references, profile, branch, onReferencesChanged, onNavigate }) {
  const module = { ...modules[name], path: name };
  const [filters, setFilters] = useState({});
  const [appliedFilters, setAppliedFilters] = useState({});
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  const query = { ...appliedFilters, page:1, limit: 25, sort: 'desc' };
  if (branch && module.filters.includes('id_sucursal')) query.id_sucursal = branch;
  const state = useRecords(client, `/${name}`, {...query,page:1}, true);
  const canWrite = module.write && can(profile, module.write);
  const createOperation = newOperation(name, profile);

  function saved(message) {
    setModal(null); setNotice(message); state.reload();
    if (module.fields) onReferencesChanged();
  }
  function filterField(name) {
    const configured = module.fields?.find(f => f.name === name);
    if (configured) return { ...configured, required: false, createOnly: false };
    const lookup = { id_sucursal_origen: 'sucursales', id_sucursal_destino: 'sucursales', id_medicamento: 'medicamentos', id_cliente: 'clientes' }[name];
    if (lookup) return { name, label: label(name), type: 'select', lookup, anyBranch: true };
    return { name, label: label(name), type: name === 'periodo' ? 'date' : 'text' };
  }
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">{module.group}</p><h1>{module.title}</h1><p>{module.description}</p></div>
      {((canWrite && module.create!==false) || createOperation) && <button className="button primary" disabled={!references.medicamentos} onClick={() => setModal(canWrite ? { type: 'record' } : { type: 'operation', operation: createOperation })}>
        <Plus size={18} />{createOperation?.title || `Crear ${module.singular}`}</button>}</div>
    <Notice success>{notice}</Notice><Notice>{state.error}</Notice>
    <section className="panel">
      <div className="table-toolbar"><div><h2>{module.title}</h2><span className="muted">{state.total} registros disponibles</span></div>
        <div className="toolbar-controls">
          <button className="icon-button" onClick={state.reload} disabled={state.loading} aria-label="Actualizar listado"><RefreshCw size={18} /></button></div></div>
      <details className="filter-panel"><summary>Filtrar registros</summary><form onSubmit={event => { event.preventDefault(); setAppliedFilters(filters); }}>
        <div className="filter-grid">{module.filters.filter(f => !branch || f !== 'id_sucursal').map(field => <Field key={field} field={filterField(field)} value={filters[field] || ''}
          onChange={(key, value) => setFilters(old => ({ ...old, [key]: value }))} references={references} profile={profile} />)}</div>
        <div className="filter-actions"><button className="button secondary small">Aplicar filtros</button><button type="button" className="button subtle small" onClick={() => { setFilters({}); setAppliedFilters({}); }}>Limpiar</button></div>
      </form></details>
      {state.loading ? <Loading /> : <ReportTable key={name+JSON.stringify(appliedFilters)} title={module.title} context={'Listado filtrado por permisos y sucursal'} rows={state.rows} columns={module.columns} rowKey={module.id} references={references}
        emptyText="No hay registros con los filtros seleccionados."
        renderActions={row => <div className="row-actions">
          <button className="icon-button" aria-label={`Ver ${module.singular} ${row[module.id]}`} onClick={() => setModal({ type: 'detail', row })}><Eye size={17} /></button>
          {canWrite && <button className="icon-button" aria-label={`Editar ${module.singular} ${row[module.id]}`} onClick={() => setModal({ type: 'record', row })}><Pencil size={16} /></button>}
          {['medicamentos','eventos'].includes(name) && canWrite && <button className="button subtle small" onClick={() => setModal({ type: 'image', row })}>Imagen</button>}
          {name==='pedidos'&&row.receta_path&&can(profile,['ADMIN','GERENTE','VENDEDOR'])&&<button className="button subtle small" onClick={()=>setModal({type:'prescription',row})}>Ver receta</button>}
          {name==='alertas-inventario'&&row.tipo==='STOCK_BAJO'&&can(profile,['ADMIN','GERENTE','BODEGA'])&&<button className="button subtle small" onClick={()=>onNavigate('inventario')}>Registrar reposici?n</button>}
          {recordActions(name, row, profile).map(action => <button key={action.title} className="button subtle small" onClick={() => setModal({ type: 'operation', operation: action })}>{action.title}</button>)}
        </div>} />}

    </section>
    {modal?.type==='prescription'&&<PrescriptionPreview client={client} id={modal.row.id_pedido} onClose={()=>setModal(null)}/>}
    {modal?.type === 'image' && <CatalogImageForm resource={name} record={modal.row} client={client} onClose={() => setModal(null)} onSaved={saved} />}
    {modal?.type === 'record' && <RecordForm module={module} record={modal.row} client={client} references={references} profile={profile} branch={branch} onClose={() => setModal(null)} onSaved={saved} />}
    {modal?.type === 'operation' && <OperationForm operation={modal.operation} client={client} references={references} profile={profile} branch={branch} onClose={() => setModal(null)} onSaved={saved} />}
    {modal?.type === 'detail' && <RecordDetail record={modal.row} module={module} references={references} client={client} onClose={() => setModal(null)} />}
  </div>;
}
