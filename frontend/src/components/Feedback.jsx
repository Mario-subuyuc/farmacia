import {useEffect,useRef} from 'react';
import { AlertCircle, CheckCircle2, Inbox, LoaderCircle, AlertTriangle, Info } from 'lucide-react';
import {notifyUser} from '../services/user-feedback.js';
export function Notice({ children, success = false, tone, announce=true }) {
 const type=tone||(success?'success':'error');const element=useRef(null);
 useEffect(()=>{if(children&&announce){notifyUser(children,type);if(type==='error'&&element.current?.closest('form'))element.current.scrollIntoView?.({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}},[children,type,announce]);
 if (!children) return null;
 const Icon={success:CheckCircle2,error:AlertCircle,warning:AlertTriangle,info:Info}[type]||Info;
 return <div ref={element} tabIndex={-1} className={`notice ${type} ${success?'success':''}`} role={['error','warning'].includes(type)?'alert':'status'}><Icon size={20} aria-hidden="true" /><div><strong className="notice-heading">{{success:'Completado',error:'Revisa lo siguiente',warning:'Atención',info:'Información'}[type]}</strong><span>{children}</span></div></div>;
}
export function Loading({ text = 'Cargando información…' }) {
 return <div className="loading" role="status" aria-busy="true"><LoaderCircle size={22} className="spin" aria-hidden="true" /><div>{text}<small>Espera un momento, estamos consultando los datos.</small></div></div>;
}
export function Empty({ title = 'Todavía no hay registros', description = 'Los registros aparecerán aquí cuando se creen.', action }) {
 return <div className="empty"><span className="empty-icon"><Inbox size={25} aria-hidden="true" /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}
