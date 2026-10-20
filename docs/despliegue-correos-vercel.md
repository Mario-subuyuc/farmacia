# Inscripciones y correo en Vercel

## Qué cambió

La inscripción y la confirmación esperan el procesamiento SMTP antes de responder. Cada solicitud reclama como máximo un correo de su propio token y etapa, mediante `tomar_correo_inscripcion`. No procesa pedidos, alertas ni recordatorios de otras personas. `src/app.js` conserva las rutas POST y el límite de solicitudes existente; Express 5 espera los controladores asíncronos y deriva sus errores al middleware.

La migración 018 conserva los estados, cinco intentos, `FOR UPDATE SKIP LOCKED`, arrendamiento de cinco minutos y espera de quince minutos tras cerrar un intento. El cierre de correos de eventos comprueba el número de intento para impedir que un proceso atrasado cierre un arrendamiento posterior. La cola general también excluye correos cuyo token ya no es el actual. No se alteran las validaciones de confirmación ni se recuperan enlaces antiguos.

Si SMTP falla, la inscripción o confirmación ya guardada permanece. Se registra el estado de la cola y un diagnóstico seguro en logs (tipo, ID, etapa, intento, código SMTP conocido y código de respuesta numérico). No se registran destinatarios, credenciales, enlaces, tokens, respuestas libres del proveedor ni cuerpos. `SMTP_ACCEPTED` significa aceptación por el servidor SMTP y registro exitoso en la cola; no garantiza entrega en la bandeja de entrada. Los resultados pendientes o inciertos nunca se presentan como enviados.

## Aplicar la migración

No se ha ejecutado SQL contra Supabase. Las migraciones 015 y 016 permanecen intactas.

1. En el proyecto Supabase correcto, abre **SQL Editor** y una consulta nueva.
2. Copia y ejecuta el contenido completo de `database/018_enrollment_email_delivery.sql`. Requiere las migraciones 001–017 ya aplicadas. La transacción falla si la definición de la cola no coincide con la esperada; no continúes el despliegue si ocurre eso.
3. Comprueba las funciones, sin reclamar ni enviar correos:

   ```sql
   select
     to_regprocedure('public.tomar_correo_inscripcion(text,text)') as selector,
     to_regprocedure('public.cerrar_correo_inscripcion(bigint,integer,boolean)') as cierre;
   ```

4. Si ya utilizas `privado.migraciones` para registrar las migraciones anteriores, registra también esta ejecución manual:

   ```sql
   insert into privado.migraciones(nombre)
   values ('018_enrollment_email_delivery.sql')
   on conflict(nombre) do nothing;
   ```

Como alternativa al SQL Editor, **solo si las migraciones anteriores ya están registradas** y `DATABASE_URL` corresponde al proyecto correcto, ejecuta `npm run db:migrate` desde la raíz. El runner incorpora la 018 y registra su aplicación dentro de la misma transacción. No uses ambas vías para aplicar el mismo archivo ni vuelvas a ejecutar las migraciones antiguas manualmente.

## Desplegar, en este orden

1. Aplica la migración antes de publicar el backend nuevo.
2. En las variables de Production del backend `farmacia-amber.vercel.app`, configura:
   - `PUBLIC_SITE_URL=https://farmacia-l8zr.vercel.app`
   - `EMAIL_WORKER_ENABLED=false`
   - Conserva las variables SMTP que ya verificaste y las claves Supabase exclusivamente en el backend.
   - Retira `SMTP_DIAGNOSTIC_ENABLED`; el diagnóstico de inicio ya fue eliminado del código.
3. Comprueba en Vercel que la función Express tenga una duración máxima de al menos 60 segundos, para dar margen a Supabase y al intercambio SMTP esperado por HTTP. Vercel puede terminar la función al superar su duración configurada; consulta su [documentación de duración](https://vercel.com/docs/functions/configuring-functions/duration). No se comprobó la configuración remota de tu proyecto.
4. Publica estos cambios en la rama conectada a tu proyecto Vercel y espera el despliegue del backend. Si tienes despliegue automático por Git, el push inicia ese despliegue; si está deshabilitado, créalo desde el panel de Deployments con el commit nuevo. Este trabajo no hace push ni despliega.
5. En el proyecto frontend, conserva `VITE_API_URL=https://farmacia-amber.vercel.app/api`, Root Directory `frontend`, Build Command `npm run build` y Output Directory `dist`. Despliega también el frontend para mostrar el resultado del correo al confirmar.
6. Comprueba `https://farmacia-amber.vercel.app/api/health`. Después realiza una inscripción nueva a una actividad publicada y futura. Este paso de aceptación sí envía un correo real y debe hacerlo un operador tras desplegar.
7. Usa exclusivamente el enlace del correo nuevo. La respuesta de inscripción debe mostrar `email.status=SMTP_ACCEPTED` si hubo aceptación y cierre exitosos. Confirma con el botón del frontend: la inscripción debe quedar `CONFIRMADA`, y el aviso final también debe procesarse antes de responder. Repetir la confirmación no crea otro aviso.

## Reintentos y recordatorios pendientes de automatizar

No hay un scheduler nuevo configurado. En Vercel no se inicia el timer de correo: los recordatorios y reintentos requieren un scheduler externo. En un servidor persistente el worker opcional de correo puede seguir funcionando. Comparte los bloqueos SQL con el procesamiento inmediato. Los timers existentes de inventario y expiración tampoco garantizan ejecución continua en Vercel; esos trabajos también necesitan programación externa si se requiere ejecución garantizada.

Para procesar manualmente un lote general desde un entorno de confianza con configuración del backend, existe:

```powershell
npm run emails:run
```

**Ese comando envía correos reales; no se ejecutó durante las pruebas.** Encola los recordatorios que ya corresponden y reclama un lote limitado por las funciones existentes (hasta diez por categoría: pedidos, alertas y eventos). No ejecuta una repetición ilimitada. El scheduler pendiente debe ejecutar este comando periódicamente en un entorno con duración suficiente para el lote completo y con secretos del backend, sin exponerlo como una ruta pública. Los trabajos de inventario y expiración también deben programarse por separado si se necesitan en Vercel.

Una solicitud repetida de inscripción vigente no rota el token ni dispara el correo existente: conserva la prevención de duplicados. Los pendientes de inscripción requieren el procesador general al llegar su fecha de reintento. Repetir la confirmación válida sí puede reclamar su aviso final si ya corresponde reintentarlo. Tras cinco intentos la fila queda en `ERROR`; no se reinicia automáticamente. Las inscripciones vencidas no reciben enlaces antiguos.

SMTP no ofrece una transacción compartida con PostgreSQL. Si acepta un mensaje pero falla el registro de su estado, o la función termina durante ese intervalo, la cola puede reintentarlo después del arrendamiento y producir una entrega duplicada. Se mantiene un `Message-ID` estable, pero no se promete entrega exactamente una vez. El resultado de ese intento se informa como pendiente/incierto y se registra `email.queue_finalize_failed` con `smtpAccepted=true` cuando se conoce la aceptación.

## Verificación local

```powershell
npm test
npm run ui:test
npm run ui:build
```

Las pruebas usan PostgreSQL local en memoria (PGlite), un adaptador Supabase simulado y transportes SMTP simulados. No usan Supabase remoto ni envían correos reales. El archivo `tests/enrollment-email-flow.test.js` cubre inscripción, espera antes de responder, confirmación, duplicados, fallos SMTP, errores de cola, tokens inválidos/vencidos, bloqueo compartido, intentos agotados, permisos y URL de producción.
