import ExperienceTools from './components/ExperienceTools.jsx';
import {clearAlertHistory} from './services/user-feedback.js';
import { useEffect, useState } from 'react';
import { api } from './services/api.js';
import PharmacyOperationsPage from './pages/PharmacyOperationsPage.jsx';
import EmailDesignPage from './pages/EmailDesignPage.jsx';
import EnrollmentPage from './pages/EnrollmentPage.jsx';
import PharmacyAssistant from './components/PharmacyAssistant.jsx';
import LandingPage, { publicPages } from './pages/LandingPage.jsx';
import PublicCatalogPage from './pages/PublicCatalogPage.jsx';
import { readSession, saveSession, subscribeSession } from './services/session.js';
import { can, modules } from './config/modules.js';
import Layout from './components/Layout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ModulePage from './pages/ModulePage.jsx';
import CallCenterPage from './pages/CallCenterPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import { Loading, Notice } from './components/Feedback.jsx';
import { consumeConfirmation } from './utils/auth-confirmation.js';

function currentPage() { return window.location.hash.slice(1) || 'home'; }

function AppContent({ confirmationMessage = '' }) {
  const [confirmationNotice, setConfirmationNotice] = useState(confirmationMessage);
  // Estado = información que React conserva. Al actualizarla cambia la pantalla.
  // App coordina el acceso; cada página se encarga de sus propios formularios.
  const [session, setSession] = useState(readSession);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authVersion, setAuthVersion] = useState(0);
  const [page, setPage] = useState(currentPage);
  const [branch, setBranch] = useState('');
  const [references, setReferences] = useState({});
  const [referenceError, setReferenceError] = useState('');
  const [referencesVersion, setReferencesVersion] = useState(0);
  const client = api;
  const userId = session?.user?.id;

  useEffect(() => subscribeSession(next=>{if(!next)clearAlertHistory();setSession(next);}), []);
  useEffect(function () {
    const changed = () => {
      const message = consumeConfirmation(window.location, window.history);
      if (message) setConfirmationNotice(message);
      setPage(currentPage());
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  function navigate(name) { window.location.hash = name; setPage(name); }

  useEffect(function () {
    let ignore = false;
    // Consultamos el perfil real; el rol nunca se decide a partir del correo.
    setAuthError(''); setReferences({});
    if (!userId) { setProfile(null); setChecking(false); return; }
    setChecking(true);
    api.get('/me').then(result => {
      if (!ignore) { setProfile(result.data); setBranch(result.data.id_sucursal ? String(result.data.id_sucursal) : ''); }
    }).catch(error => { if (!ignore) { setProfile(null); setAuthError(error.message); } })
      .finally(() => { if (!ignore) setChecking(false); });
    return () => { ignore = true; };
  }, [userId, authVersion]);

  useEffect(function () {
    if (!profile) return;
    // Estos catálogos alimentan los selectores y convierten IDs en nombres.
    let ignore = false; setReferenceError('');
    Promise.all([can(profile,['ADMIN','GERENTE','BODEGA','AUDITOR'])?client.getAll('/proveedores'):Promise.resolve([]),client.getAll('/sucursales'), client.getAll('/medicamentos'), client.getAll('/clientes'),
      can(profile, modules.empleados.read) ? client.getAll('/empleados') : Promise.resolve([])])
      .then(([proveedores, sucursales, medicamentos, clientes, empleados]) => { if (!ignore) setReferences({ proveedores, sucursales, medicamentos, clientes, empleados }); })
      .catch(error => { if (!ignore) setReferenceError(error.message); });
    return () => { ignore = true; };
  }, [client, profile, referencesVersion]);

  function logout() { clearAlertHistory();saveSession(null); setProfile(null); setAuthError(''); navigate('catalogo'); }
  if(page.startsWith('inscripcion/'))return <EnrollmentPage token={page.slice(12)} onNavigate={navigate}/>;
  if (publicPages.some(([route])=>route===page)) return <><LandingPage key={page} page={page} onNavigate={navigate} hasSession={Boolean(session)} /><PharmacyAssistant onCatalog={() => navigate('catalogo')} /></>;
  if (page === 'catalogo') return <><PublicCatalogPage onNavigate={navigate} hasSession={Boolean(session)} /><PharmacyAssistant onCatalog={() => navigate('catalogo')} /></>;
  if (checking) return <div className="startup"><span className="brand-mark">+</span><Loading text="Verificando tu acceso…" /></div>;
  if (!profile) return <AuthPage confirmationMessage={confirmationNotice} error={authError} hasSession={Boolean(session)} onRetry={() => setAuthVersion(v => v + 1)}
    onLoggedIn={() => { navigate('inicio'); setAuthVersion(v => v + 1); }} onCatalog={() => navigate('catalogo')} />;

  const common = { client, profile, references, branch, onNavigate: navigate };
  let content;
  if (page === 'inicio') content = <DashboardPage {...common} />;
  else if(page==='operaciones-farmacia'&&can(profile,['ADMIN','GERENTE','BODEGA','CAJERO']))content=<PharmacyOperationsPage {...common}/>;
  else if(page==='diseno-correo'&&profile.rol==='ADMIN')content=<EmailDesignPage client={client}/>;
  else if (page === 'call-center' && can(profile, ['ADMIN', 'GERENTE', 'VENDEDOR', 'CALL_CENTER'])) content = <CallCenterPage {...common} />;
  else if (page === 'reportes' && can(profile, ['ADMIN', 'GERENTE', 'AUDITOR'])) content = <ReportsPage {...common} />;
  else if (modules[page] && can(profile, modules[page].read)) content = <ModulePage key={`${page}-${branch}`} {...common} name={page} onReferencesChanged={() => { setReferencesVersion(v => v + 1); if (page === 'perfiles') setAuthVersion(v => v + 1); }} />;
  else content = <div className="panel unavailable"><h1>Página no disponible</h1><p>La dirección no existe o tu rol no tiene acceso.</p><button className="button primary" onClick={() => navigate('inicio')}>Ir al inicio</button></div>;

  return <Layout {...common} page={page} email={session?.user?.email} onBranch={setBranch} onLogout={logout}>
    <Notice>{referenceError ? `${referenceError} No se pudieron cargar las opciones de los formularios.` : ''}</Notice>
    {referenceError && <button className="button secondary small" onClick={() => setReferencesVersion(v => v + 1)}>Reintentar carga de opciones</button>}
    {content}
  </Layout>;
}

export default function App(props){return <><AppContent {...props}/><ExperienceTools/></>;}
