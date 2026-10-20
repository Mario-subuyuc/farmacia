// Ejecución explícita por un operador o scheduler de confianza, nunca desde HTTP público.
import {processEmails} from '../src/services/email-worker.js';
try {
 const result=await processEmails();
 console.log('email.batch_completed',result);
 if(result.failed || result.unrecorded)process.exitCode=1;
}catch{
 console.error('email.batch_failed');
 process.exitCode=1;
}
