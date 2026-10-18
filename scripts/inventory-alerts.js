import 'dotenv/config';
import {createAuthAdminClient} from '../src/config/database.js';
import {processEmails} from '../src/services/email-worker.js';
try{const result=await createAuthAdminClient().rpc('generar_alertas_inventario');if(result.error)throw Error('No se pudieron generar las alertas');console.log('Alertas activas:',result.data);if(process.argv.includes('--send')){await processEmails();console.log('Ciclo de correo procesado. Revisa los estados del panel.');}}catch(error){console.error(error.message);process.exitCode=1;}
