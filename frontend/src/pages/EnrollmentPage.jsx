import {useState} from 'react';
import {api} from '../services/api.js';
import {dateTime} from '../utils/format.js';
import {Notice} from '../components/Feedback.jsx';
export default function EnrollmentPage({token,onNavigate}){
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function act(cancelar=false){setBusy(true);setError('');try{const response=await api.publicPost('/eventos/confirmar',{token,cancelar});setResult(response.data);}catch(failure){setError(failure.message);}finally{setBusy(false);}}
 return <main className="enrollment-page panel page-stack"><h1>Tu inscripción a la actividad</h1><Notice>{error}</Notice>{result?<><h2>{result.titulo}</h2><p>Estado: {result.estado}</p><p>{dateTime(result.inicio)}</p>{result.estado==='CONFIRMADA'&&<button className="button secondary" disabled={busy} onClick={()=>act(true)}>Cancelar mi inscripción</button>}</>:<><p>Confirma tu correo para reservar tu lugar y recibir el recordatorio de la actividad.</p><button className="button primary" disabled={busy} onClick={()=>act(false)}>Confirmar inscripción</button></>}<button className="button subtle" onClick={()=>onNavigate('home')}>Volver a la farmacia</button></main>;
}
