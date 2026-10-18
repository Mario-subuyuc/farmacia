import { useEffect, useId, useRef } from 'react';
import {dismissFeedback} from '../services/user-feedback.js';
import { X } from 'lucide-react';

export default function Modal({ title, description, children, onClose, busy = false, wide = false }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(function () { const previous=document.activeElement;dialog.current.showModal();return()=>{dismissFeedback();if(previous?.isConnected)previous.focus();}; }, []);
  return <dialog ref={dialog} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby={titleId}
    onCancel={function (event) { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="modal-heading"><div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>
      <button className="icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar ventana"><X size={20} /></button></div>
    {children}
  </dialog>;
}
