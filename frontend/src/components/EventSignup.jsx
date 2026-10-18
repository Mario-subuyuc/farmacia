import {useState} from 'react';
import {api} from '../services/api.js';
import {Notice} from './Feedback.jsx';
export default function EventSignup({id}){
 const [form,setForm]=useState({nombre:'',email:'',telefono:''}),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function submit(event){event.preventDefault();setBusy(true);setError('');try{const result=await api.publicPost('/eventos/inscribirse',{id_evento:Number(id),...form,telefono:form.telefono||null});setMessage(result.message);}catch(failure){setError(failure.message);}finally{setBusy(false);}}
 return <section><h3>Inscribirme a la actividad</h3>{message?<Notice success>{message}</Notice>:<form className="page-stack" onSubmit={submit}>{[['nombre','Nombre','text'],['email','Correo para confirmar y recibir recordatorios','email'],['telefono','Teléfono (opcional)','tel']].map(([name,label,type])=><label key={name}>{label}<input type={type} required={name!=='telefono'} maxLength={name==='telefono'?30:150} value={form[name]} onChange={e=>setForm(old=>({...old,[name]:e.target.value}))}/></label>)}<p>Recibirás un correo para confirmar tu lugar. El enlace vence en dos horas.</p><Notice>{error}</Notice><button className="button primary" disabled={busy}>{busy?'Enviando…':'Solicitar inscripción'}</button></form>}</section>;
}
