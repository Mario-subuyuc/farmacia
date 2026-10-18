import { useState } from 'react';
import { Headset, MapPin, Clock3, Search, ShoppingBag } from 'lucide-react';
import Field from '../components/Field.jsx';
import ItemsEditor from '../components/ItemsEditor.jsx';
import OperationForm from '../components/OperationForm.jsx';
import { Notice, Empty } from '../components/Feedback.jsx';
import { parseItems } from '../utils/forms.js';
import { money } from '../utils/format.js';
import { newOperation } from '../config/operations.js';
import { can, inBranch } from '../config/modules.js';

export default function CallCenterPage({ client, profile, references, branch }) {
  const [coordinates, setCoordinates] = useState({ latitud: '', longitud: '' });
  const [items, setItems] = useState([{ id_medicamento: '', cantidad: 1 }]);
  const [candidates, setCandidates] = useState(null);
  const [searched, setSearched] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [operation, setOperation] = useState(null);
  function changedCoordinates(name, value) { setCoordinates(old => ({ ...old, [name]: value })); setCandidates(null); }
  async function search(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setCandidates(null);
    try {
      const body = { latitud: Number(coordinates.latitud), longitud: Number(coordinates.longitud), items: parseItems(items) };
      const result = await client.write('POST', '/disponibilidad', body);
      setCandidates(result.data); setSearched(body);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  function choose(candidate) {
    setOperation({ ...newOperation('pedidos', profile), initial: { ...searched, id_sucursal: candidate.id_sucursal, canal: 'TELEFONO' } });
  }
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">Coordinación de entregas</p><h1>Call center</h1><p>Encuentra la sucursal que puede atender el pedido completo.</p></div><span className="feature-chip"><Headset size={18} />Atención centralizada</span></div>
    <Notice>{error}</Notice><Notice success>{notice}</Notice>
    <div className="callcenter-layout"><section className="panel form-panel"><h2>¿Dónde entregamos?</h2><p className="muted">Ingresa la ubicación del cliente y los medicamentos solicitados.</p>
      <form onSubmit={search}><div className="form-grid">{['latitud', 'longitud'].map(name => <Field key={name} field={{ name, label: name === 'latitud' ? 'Latitud' : 'Longitud', type: 'number', min: name === 'latitud' ? -90 : -180, max: name === 'latitud' ? 90 : 180, step: 'any', required: true }} value={coordinates[name]} onChange={changedCoordinates} disabled={busy} />)}</div>
        <ItemsEditor rows={items} onChange={value => { setItems(value); setCandidates(null); }} medicines={references.medicamentos || []} disabled={busy} />
        <button className="button primary full-width" disabled={busy || !references.medicamentos}><Search size={18} />{busy ? 'Consultando…' : 'Consultar disponibilidad'}</button>
      </form><p className="fine-print">Consultar no reserva stock. Al crear el pedido se valida nuevamente. El tiempo estimado usa cobertura y velocidad de la sucursal.</p>
    </section><section><div className="section-heading"><h2>Sucursales disponibles</h2>{candidates && <span className="count-chip">{candidates.length} opciones</span>}</div>
      {candidates === null ? <div className="panel"><Empty title="La mejor opción empieza aquí" description="Completa la consulta para ver disponibilidad, precio y tiempo estimado." /></div>
        : !candidates.length ? <div className="panel"><Empty title="Sin cobertura para este pedido" description="Ninguna sucursal tiene todos los medicamentos disponibles dentro de su radio de entrega." /></div>
          : <div className="candidate-list">{candidates.map((candidate, index) => <article className="candidate-card" key={candidate.id_sucursal}>{index === 0 && <span className="candidate-recommendation">Menor tiempo estimado</span>}
            <h3>{candidate.nombre}</h3><p><MapPin size={15} />{candidate.departamento} · {candidate.distancia_km} km</p>
            <div className="candidate-stats"><span><Clock3 size={18} /><strong>{candidate.tiempo_estimado_minutos} min</strong><small>Tiempo estimado</small></span><span><strong>{money(candidate.total)}</strong><small>Total de catálogo</small></span></div>
            <ul className="candidate-items">{candidate.items.map(item => <li key={item.id_medicamento}><span>{references.medicamentos?.find(m => m.id_medicamento === item.id_medicamento)?.nombre || `Medicamento #${item.id_medicamento}`}</span><strong>{item.disponible} disponibles{item.requiere_receta ? ' · Con receta' : ''}</strong></li>)}</ul>
            <p className="fine-print">Pago: {candidate.metodos_pago.map(m => m.toLowerCase()).join(', ')}.</p>
            <button className="button secondary full-width" disabled={!can(profile, ['ADMIN', 'CALL_CENTER']) && !inBranch(profile, candidate.id_sucursal)} onClick={() => choose(candidate)}><ShoppingBag size={17} />Crear pedido en esta sucursal</button>
          </article>)}</div>}
    </section></div>
    {operation && <OperationForm operation={operation} client={client} references={references} profile={profile} branch={branch} onClose={() => setOperation(null)} onSaved={message => { setOperation(null); setNotice(message); setCandidates(null); }} />}
  </div>;
}
