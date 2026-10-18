import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { Notice } from './Feedback.jsx';
export default function PrescriptionPreview({client,id,onClose}){
 const [url,setUrl]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let alive=true;client.get('/pedidos/'+id+'/receta').then(result=>{if(alive)setUrl(result.data.url);}).catch(failure=>{if(alive)setError(failure.message);});return()=>{alive=false;};},[client,id]);
 return <Modal title={'Receta del pedido #'+id} onClose={onClose} wide><p>Documento privado. El enlace vence a los dos minutos; vuelve a abrirlo si expiró.</p><Notice>{error}</Notice>{url?<img src={url} alt="Receta adjunta por el cliente" style={{maxWidth:'100%',maxHeight:'65vh',objectFit:'contain'}}/>:!error&&<p>Cargando receta…</p>}</Modal>;
}
