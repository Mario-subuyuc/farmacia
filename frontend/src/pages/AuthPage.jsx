import { useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, Pill, ShieldCheck, Building2, Truck } from 'lucide-react';
import { api } from '../services/api.js';
import { saveSession } from '../services/session.js';
import { Notice } from '../components/Feedback.jsx';

export default function AuthPage({ onCatalog, onLoggedIn, error: accessError, onRetry, hasSession, confirmationMessage = '' }) {
  const [values, setValues] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const body = { email: values.email, password: values.password };
      const result = await api.publicPost('/login', body);
      if (result.session) { saveSession({ user: result.user, session: result.session }); onLoggedIn(); }
      else { setNotice(result.message); setValues(old => ({ ...old, password: '' })); }
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  function change(event) { setValues(old => ({ ...old, [event.target.name]: event.target.value })); }
  return <div className="auth-layout"><section className="auth-story"><a href="#inicio" className="brand auth-brand"><span className="brand-mark">+</span><span>Nexo<span className="brand-light">Farma</span></span></a>
    <div className="auth-story-content"><span className="story-tag"><span />Una red. Un mismo cuidado.</span><h1>Más cerca de<br />cada sucursal.<br /><em>Más cerca de todos.</em></h1><p>Inventario, equipo y entregas conectados para que cada medicamento llegue donde hace falta.</p>
      <div className="story-features"><span><Building2 size={20} />Tu red de farmacias</span><span><Pill size={20} />Inventario trazable</span><span><Truck size={20} />Entregas coordinadas</span></div></div>
    <div className="auth-story-bottom"><ShieldCheck size={18} /><span>Acceso según tu rol y sucursal.</span></div>
    <div className="auth-decoration" aria-hidden="true"><span>+</span></div>
  </section><main className="auth-main"><div className="auth-form-wrap"><div className="auth-eyebrow">Acceso del personal</div><h2>Bienvenido de nuevo</h2><p className="auth-subtitle">Ingresa con la cuenta que te asignó el administrador.</p>
    <Notice>{error || accessError}</Notice><Notice success>{notice || confirmationMessage}</Notice>
    {hasSession && accessError && <button className="button secondary full-width" onClick={onRetry}>Volver a verificar mi acceso</button>}
    <form onSubmit={submit} className="auth-form">
      <label>Correo electrónico<input name="email" type="email" placeholder="tu@correo.com" value={values.email} onChange={change} required autoComplete="email" disabled={busy} /></label>
      <label>Contraseña<span className="password-input"><input name="password" type={showPassword ? 'text' : 'password'} placeholder="Tu contraseña" value={values.password} onChange={change} required minLength={1} autoComplete="current-password" disabled={busy} />
        <button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></span></label>
      <button className="button primary full-width" disabled={busy}>{busy ? 'Conectando…' : 'Iniciar sesión'}<ArrowRight size={18} /></button></form>
    <p className="auth-access-note">¿Necesitas acceso? Solicita una cuenta al administrador.</p>
    <div className="auth-divider"><span>Consulta pública</span></div>
    <button className="button secondary full-width" onClick={onCatalog} disabled={busy}>Ver catálogo de medicamentos<ArrowRight size={18} /></button>
    <p className="auth-access-note"><Check size={14} />Productos y sucursales · Sin iniciar sesión</p>
    <footer className="auth-footer">Nexo Farma · Un mejor cuidado empieza con una buena gestión.</footer>
  </div></main></div>;
}
