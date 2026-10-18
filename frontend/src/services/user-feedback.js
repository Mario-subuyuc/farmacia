import Swal from 'sweetalert2';
const listeners=new Set();let history=[];let lastKey='',lastTime=0;let audio;let lastSound=0;
export function alertHistory(){return history;}
export function subscribeAlerts(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function soundEnabled(){try{return localStorage.getItem('nexo-alert-sound')==='true';}catch{return false;}}
export function setSoundEnabled(enabled){try{localStorage.setItem('nexo-alert-sound',String(enabled));}catch{}if(enabled)playAlertSound('success',true);}
export async function playAlertSound(tone='info',force=false){
 if(!force&&(!soundEnabled()||Date.now()-lastSound<800))return;lastSound=Date.now();
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio??=new Audio();if(audio.state==='suspended')await audio.resume();if(audio.state!=='running')return;const now=audio.currentTime;const frequencies=tone==='error'?[330,260]:tone==='warning'?[440,440]:[660,880];frequencies.forEach((frequency,index)=>{const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,now+index*.12);gain.gain.linearRampToValueAtTime(.045,now+index*.12+.015);gain.gain.exponentialRampToValueAtTime(.001,now+index*.12+.11);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(now+index*.12);oscillator.stop(now+index*.12+.12);});}catch{/* El aviso visual sigue funcionando si el navegador bloquea audio. */}
}
const titles={success:'Acción completada',error:'No se pudo completar',warning:'Requiere atención',info:'Información'};
export function clearAlertHistory(){history=[];listeners.forEach(listener=>listener(history));}
export function notifyUser(message,tone='info'){
 if(typeof message!=='string'||!message.trim())return;const key=tone+message;if(lastKey===key&&Date.now()-lastTime<1500)return;lastKey=key;lastTime=Date.now();
 history=[{id:crypto.randomUUID(),message,tone,time:new Date().toISOString()},...history].slice(0,30);listeners.forEach(listener=>listener(history));playAlertSound(tone);
 // Los detalles permanecen junto al formulario y en el historial; el toast no roba el foco.
 if(Swal.isVisible()&&!Swal.getPopup()?.classList.contains('swal2-toast'))return;
 const target=document.querySelector('dialog[open]')||document.body;
 void Swal.fire({target,toast:true,position:'top-end',icon:tone,titleText:titles[tone],text:'Consulta el detalle en el aviso de la página.',showConfirmButton:false,showCloseButton:true,closeButtonAriaLabel:'Cerrar aviso',timer:tone==='error'?8000:4500,timerProgressBar:true,didOpen:popup=>{popup.addEventListener('mouseenter',Swal.stopTimer);popup.addEventListener('mouseleave',Swal.resumeTimer);},customClass:{container:'nexo-alert-container',popup:'nexo-toast'}});
}
export async function confirmAction({title,text,confirmText='Sí, continuar',danger=false}){
 const target=document.querySelector('dialog[open]')||document.body;
 const result=await Swal.fire({target,titleText:title,text,icon:danger?'warning':'question',showCancelButton:true,confirmButtonText:confirmText,cancelButtonText:'Volver sin cambios',focusCancel:true,reverseButtons:true,allowOutsideClick:false,heightAuto:false,keydownListenerCapture:true,confirmButtonColor:danger?'#b42334':'#15695c',cancelButtonColor:'#52645d',customClass:{container:'nexo-alert-container',popup:'nexo-confirm'},didOpen:()=>playAlertSound('warning')});return result.isConfirmed;
}
export function closeTransientAlert(){if(Swal.getPopup()?.classList.contains('swal2-toast'))Swal.close();}

export function dismissFeedback(){Swal.close();}
