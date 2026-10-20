import {normalize} from '../utils/table-export.js';
import { useEffect, useState } from 'react';
import { LogOut, Menu, X, MapPin } from 'lucide-react';
import Icon from './Icon.jsx';
import { modules, can } from '../config/modules.js';
import { words } from '../utils/format.js';

export default function Layout({ children, profile, email, page, onNavigate, branch, onBranch, references, onLogout }) {
  const [open, setOpen] = useState(false);
  const [menuSearch,setMenuSearch]=useState('');
  const specialNames={inicio:'Inicio','call-center':'Call center','operaciones-farmacia':'Operaciones de farmacia','diseno-correo':'Diseño de correos',reportes:'Reportes'};
  const matches=title=>normalize(title).includes(normalize(menuSearch));
  const accessibleTitles=[...Object.values(modules).filter(config=>can(profile,config.read)).map(config=>config.title),'Inicio',...(can(profile,['ADMIN','GERENTE','VENDEDOR','CALL_CENTER'])?['Call center']:[]),...(can(profile,['ADMIN','GERENTE','BODEGA','CAJERO'])?['Operaciones de farmacia']:[]),...(profile.rol==='ADMIN'?['Diseño de correos']:[]),...(can(profile,['ADMIN','GERENTE','AUDITOR'])?['Reportes']:[])];
  useEffect(()=>{if(!open||!window.matchMedia('(max-width:760px)').matches)return;const previous=document.activeElement,oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';const aside=document.querySelector('.sidebar');aside?.querySelector('input')?.focus();function keys(event){if(event.key==='Escape'){setOpen(false);return;}if(event.key!=='Tab')return;const elements=[...aside.querySelectorAll('a,button:not(:disabled),input,select')].filter(element=>element.getClientRects().length&&!element.hidden);const first=elements[0],last=elements.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}document.addEventListener('keydown',keys);return()=>{document.removeEventListener('keydown',keys);document.body.style.overflow=oldOverflow;if(previous?.isConnected)previous.focus();};},[open]);
  const currentTitle=modules[page]?.title||specialNames[page]||'Panel';
  useEffect(()=>{document.title=currentTitle+' | NexoFarma';window.scrollTo(0,0);const main=document.getElementById('main-content');main?.focus({preventScroll:true});},[page,currentTitle]);
  function navigate(name) { onNavigate(name); setOpen(false);setMenuSearch(''); }
  const groups = ['Operación', 'Finanzas', 'Administración', 'Control'];
  return <div className="app-layout"><a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content').focus(); }}>Ir al contenido</a>
    {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Cerrar menú" />}
    <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Menú principal"><div className="sidebar-brand"><a className="brand" href="#inicio" onClick={() => setOpen(false)}><span className="brand-mark">+</span><span>Nexo<span className="brand-light">Farma</span><small>GESTIÓN DE FARMACIAS</small></span></a>
      <button className="icon-button mobile-close" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={20} /></button></div>
      <div className="navigation-search"><label><span>Buscar módulo</span><input type="search" placeholder="Inventario, caja, pedidos…" value={menuSearch} onChange={e=>setMenuSearch(e.target.value)}/></label></div><nav className="navigation" aria-label="Módulos de farmacia"><button hidden={!matches('Inicio')} className={`nav-link ${page === 'inicio' ? 'active' : ''}`} onClick={() => navigate('inicio')} aria-current={page === 'inicio' ? 'page' : undefined}><Icon name="LayoutDashboard" /><span>Inicio</span></button>
        {matches('Call center') && can(profile, ['ADMIN', 'GERENTE', 'VENDEDOR', 'CALL_CENTER']) && <button className={`nav-link ${page === 'call-center' ? 'active' : ''}`} onClick={() => navigate('call-center')} aria-current={page === 'call-center' ? 'page' : undefined}><Icon name="Headset" /><span>Call center</span></button>}
        {matches('Operaciones de farmacia')&&can(profile,['ADMIN','GERENTE','BODEGA','CAJERO'])&&<button aria-current={page==='operaciones-farmacia'?'page':undefined} className={'nav-link '+(page==='operaciones-farmacia'?'active':'')} onClick={()=>navigate('operaciones-farmacia')}><Icon name="Package"/><span>Operaciones de farmacia</span></button>}
        {matches('Diseño de correos')&&profile.rol==='ADMIN'&&<button aria-current={page==='diseno-correo'?'page':undefined} className={'nav-link '+(page==='diseno-correo'?'active':'')} onClick={()=>navigate('diseno-correo')}><Icon name="Mail"/><span>Diseño de correos</span></button>}
        {menuSearch&&!accessibleTitles.some(matches)&&<div className="navigation-empty"><p>No encontramos ese módulo.</p><button className="button subtle small" onClick={()=>setMenuSearch('')}>Ver todos los módulos</button></div>}
        {groups.map(group => {
          const entries = Object.entries(modules).filter(([, config]) => config.group === group && can(profile, config.read) && matches(config.title));
          if (!entries.length && !(group === 'Finanzas' && matches('Reportes') && can(profile, ['ADMIN', 'GERENTE', 'AUDITOR']))) return null;
          return <div className="nav-group" key={group}><p>{group}</p>{entries.map(([name, config]) => <button key={name} className={`nav-link ${page === name ? 'active' : ''}`} aria-current={page === name ? 'page' : undefined} onClick={() => navigate(name)}><Icon name={config.icon} /><span>{config.title}</span></button>)}
            {group === 'Finanzas' && matches('Reportes') && can(profile, ['ADMIN', 'GERENTE', 'AUDITOR']) && <button className={`nav-link ${page === 'reportes' ? 'active' : ''}`} onClick={() => navigate('reportes')} aria-current={page === 'reportes' ? 'page' : undefined}><Icon name="ChartNoAxesCombined" /><span>Reportes</span></button>}</div>;
        })}</nav>
      <div className="sidebar-bottom"><button className="button subtle small" onClick={() => navigate('catalogo')}>Ver catálogo público</button><div className="sidebar-help"><span className="little-plus">+</span><div><strong>Todo empieza aquí</strong><p>Una red mejor coordinada.</p></div></div>
        <button className="nav-link logout" onClick={onLogout}><LogOut size={18} /><span>Salir de esta pestaña</span></button></div>
    </aside>
    <div className="app-main"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={22} /></button>
      <span className="workspace-label">{currentTitle}</span><span className="topbar-divider" />
      <label className="branch-selector"><MapPin size={16} aria-hidden="true" /><span className="sr-only">Alcance por sucursal</span><select value={branch} onChange={event => onBranch(event.target.value)} disabled={Boolean(profile.id_sucursal) && !['ADMIN', 'AUDITOR', 'CALL_CENTER'].includes(profile.rol)}>
        <option value="">Todas las sucursales</option>{references.sucursales?.map(s => <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>)}</select></label></div>
      <div className="account"><span data-experience-tools=""/><span className="connection-state"><span />Sesión verificada</span><span className="account-divider" /><div className="avatar">{(email || profile.rol).slice(0, 2).toUpperCase()}</div><div className="account-label"><strong>{email?.split('@')[0] || 'Mi cuenta'}</strong><small>{words(profile.rol)}</small></div></div>
    </header>
      <main id="main-content" className="content" tabIndex={-1}><div className="workspace-context"><span>Panel / <strong>{currentTitle}</strong></span><span>{profile.rol==='AUDITOR'?'Solo lectura · ':''}{branch?(references.sucursales?.find(row=>String(row.id_sucursal)===String(branch))?.nombre||'Sucursal seleccionada'):'Todas las sucursales autorizadas'}</span></div>{children}</main><footer className="app-footer"><span>Nexo Farma</span><span>Operaciones conectadas. Atención más cercana.</span><span>Guatemala · GTQ</span></footer>
    </div>
  </div>;
}
