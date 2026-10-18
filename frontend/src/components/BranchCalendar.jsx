import {useEffect,useState} from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import luxonPlugin from '@fullcalendar/luxon3';
import es from '@fullcalendar/core/locales/es';
import {api} from '../services/api.js';
import {dateTime} from '../utils/format.js';
import EventSignup from './EventSignup.jsx';
import Modal from './Modal.jsx';
export default function BranchCalendar(){
 const [branches,setBranches]=useState([]),[branch,setBranch]=useState(''),[selected,setSelected]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;api.publicGet('/catalogo',{limit:1}).then(result=>{if(active)setBranches(result.sucursales);}).catch(()=>{});return()=>{active=false;};},[]);
 return <section className="home-section branch-calendar" id="home-events"><div className="home-section-heading"><div><span className="home-kicker">APRENDEMOS EN COMUNIDAD</span><h2>Talleres y actividades en sucursal.</h2></div><label>Sucursal<select aria-label="Sucursal de eventos" value={branch} onChange={e=>setBranch(e.target.value)}><option value="">Todas las sucursales</option>{branches.map(row=><option key={row.id_sucursal} value={row.id_sucursal}>{row.nombre}</option>)}</select></label></div><p className="home-section-intro">Explora el calendario y selecciona una actividad para ver su fotografía, descripción, lugar y horario. Las actividades aparecen cuando el administrador las publica.</p>{error&&<p role="alert">{error}</p>}
 <FullCalendar key={branch} plugins={[dayGridPlugin,timeGridPlugin,listPlugin,luxonPlugin]} locale={es} timeZone="America/Guatemala" initialView={window.innerWidth<600?'listMonth':'dayGridMonth'} headerToolbar={{left:'prev,next today',center:'title',right:'dayGridMonth,timeGridWeek,listMonth'}} height="auto" displayEventTime eventTimeFormat={{hour:'2-digit',minute:'2-digit',hour12:false}} events={async(range,success,failure)=>{try{const result=await api.publicGet('/eventos-publicos',{start:range.startStr,end:range.endStr});setError('');success(result.data.filter(row=>!branch||String(row.id_sucursal)===branch).map(row=>({...row,extendedProps:row})));}catch(error){setError(error.message);failure(error);}}} eventClick={info=>setSelected(info.event.extendedProps)} noEventsContent="No hay actividades publicadas para este período."/>
 {selected&&<Modal title={selected.title} onClose={()=>setSelected(null)} wide>{selected.foto_url&&<img className="event-photo" src={selected.foto_url} alt={selected.title}/>}<p className="event-description">{selected.descripcion}</p><p><strong>{selected.sucursal}</strong> · {selected.direccion}</p><p>Inicio: {dateTime(selected.start)}<br/>Finaliza: {dateTime(selected.end)}</p>{selected.telefono&&<a href={'tel:'+selected.telefono.replace(/[^+0-9]/g,'')}>Consultar en sucursal: {selected.telefono}</a>}<EventSignup id={selected.id}/></Modal>}
 </section>;
}
