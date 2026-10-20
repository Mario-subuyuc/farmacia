import { startEmailWorker, startInventoryAlerts } from './services/email-worker.js';
import { startExpirationJob } from './services/expiration-job.js';
import app from './app.js';
import { PORT } from './config/config.js';

// El correo inmediato se espera en HTTP; el timer queda para servidores persistentes.
const persistentServer = !process.env.VERCEL;
const stopAlerts=(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)?startInventoryAlerts():()=>{};
const stopEmails=persistentServer && process.env.EMAIL_WORKER_ENABLED==='true'&&process.env.SMTP_USER?startEmailWorker():()=>{};
const stopExpiration=process.env.EXPIRATION_JOB_ENABLED!=='false' && (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)?startExpirationJob():()=>{};
// app configura Express; listen abre el puerto para recibir peticiones.
const server = app.listen(PORT, () => {
  console.log(`Servidor disponible en http://localhost:${PORT}`);
});

server.on('error', (error) => {
  console.error('No se pudo iniciar el servidor:', error.message);
  process.exitCode = 1;
});

for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopAlerts();stopEmails();stopExpiration();server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();});
