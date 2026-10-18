import {useEffect,useId,useRef,useState} from 'react';
import {api} from '../services/api.js';
import {money} from '../utils/format.js';
export default function ProductAutocomplete({value,onChange,onSelect,id,category='',branch='',...props}){
 const generated=useId(),listId=generated+'-suggestions';
 const [rows,setRows]=useState([]),[open,setOpen]=useState(false),[active,setActive]=useState(-1),[loading,setLoading]=useState(false),[message,setMessage]=useState('');
 const skip=useRef(false);
 useEffect(()=>{
  let ignored=false;setRows([]);setActive(-1);setMessage('');
  if(skip.current){skip.current=false;setLoading(false);return;}
  if(value.trim().length<2){setLoading(false);return;}
  setLoading(true);
  const timer=setTimeout(()=>{api.publicPost('/asistente/productos',{consulta:value,...(category?{categoria:category}:{})}).then(result=>{if(ignored)return;const options=result.data.filter(row=>!branch||row.sucursales.some(s=>String(s.id_sucursal)===String(branch))).slice(0,6);setRows(options);setMessage(options.length?'':'Sin coincidencias. Prueba otro nombre o principio activo.');}).catch(()=>{if(!ignored)setMessage('No se pudieron cargar las sugerencias. Puedes usar Buscar.');}).finally(()=>{if(!ignored)setLoading(false);});},300);
  return()=>{ignored=true;clearTimeout(timer);};
 },[value,category,branch]);
 function choose(row){skip.current=true;onChange(row.nombre);setRows([]);setOpen(false);setActive(-1);onSelect?.(row);}
 function keyboard(event){
  if(event.key==='Escape'){setOpen(false);setActive(-1);return;}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);setActive(old=>rows.length?(event.key==='ArrowDown'?(old+1)%rows.length:(old<=0?rows.length-1:old-1)):-1);}
  if(event.key==='Enter'&&active<0)setOpen(false);
  if(event.key==='Enter'&&open&&active>=0&&rows[active]){event.preventDefault();choose(rows[active]);}
 }
 return <div className="product-autocomplete"><input {...props} id={id||generated} role="combobox" aria-autocomplete="list" aria-expanded={open&&(rows.length>0||loading||Boolean(message))} aria-controls={listId} aria-activedescendant={open&&active>=0?listId+'-'+active:undefined} autoComplete="off" value={value} onChange={event=>{skip.current=false;setOpen(true);onChange(event.target.value);}} onFocus={()=>setOpen(true)} onBlur={()=>{setOpen(false);setActive(-1);}} onKeyDown={keyboard}/>
  {open&&(rows.length>0||loading||message)&&<div className="autocomplete-menu">{loading?<p role="status">Buscando sugerencias…</p>:rows.length?<ul id={listId} role="listbox" aria-label="Sugerencias de productos">{rows.map((row,index)=><li key={row.id_medicamento} role="option" id={listId+'-'+index} aria-selected={active===index} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(row)}><span><strong>{row.nombre}</strong><small>{row.principio_activo}</small></span><span>{money(row.precio_venta)}</span></li>)}</ul>:<p role="status">{message}</p>}</div>}
 </div>;
}
