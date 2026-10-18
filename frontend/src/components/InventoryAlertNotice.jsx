import {useEffect,useState} from 'react';
export default function InventoryAlertNotice({client,branch,onNavigate}){
 const [count,setCount]=useState(0);
 useEffect(()=>{let active=true;const refresh=()=>client.get('/alertas-inventario',{estado:'ACTIVA',...(branch?{id_sucursal:branch}:{}),limit:1}).then(result=>{if(active)setCount(result.pagination.total);}).catch(()=>{});refresh();const timer=setInterval(refresh,60000);return()=>{active=false;clearInterval(timer);};},[client,branch]);
 return count>0?<section className="inventory-alert-banner" role="status"><div><strong>{count} alertas de inventario requieren revisión</strong><p>Revisa lotes vencidos, próximos a vencer y productos que necesitan reposición.</p></div><button className="button secondary" onClick={()=>onNavigate('alertas-inventario')}>Revisar alertas</button></section>:null;
}
