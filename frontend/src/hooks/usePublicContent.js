import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
export function usePublicContent(){const [content,setContent]=useState(null);useEffect(()=>{let alive=true;api.publicGet('/contenido').then(result=>{if(alive)setContent(result.data);}).catch(()=>{});return()=>{alive=false;};},[]);return content;}
