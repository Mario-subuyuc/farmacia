# Limpieza de datos operativos

Registro histórico: después de esta limpieza se cargaron los datos iniciales actuales. Para consultar cantidades y funcionamiento vigentes, véase [Estado actual del portal](ESTADO-ACTUAL.md).

El 13 de noviembre de 2026 se vaciaron 32 tablas operativas (242 registros) de la base conectada. Se conservaron las tres cuentas y sus credenciales, perfiles, permisos, tres sucursales, cuatro plantillas de correo, contenido del portal, migraciones y auditoría. Se agregó un registro de auditoría de la limpieza.

Los archivos de Storage se conservaron. El respaldo previo incluye los cuatro esquemas `public`, `privado`, `auth` y `storage`, y existe una copia separada de los archivos. Los respaldos y el informe de la ejecución están en `backups/`, excluido de Git.

El catálogo, inventario, pedidos, ventas y demás módulos operativos quedaron vacíos, listos para registrar los nuevos datos. Todavía no se cargó información ficticia nueva.

## Herramienta de mantenimiento

`scripts/clean-operational-data.js` es una herramienta manual y destructiva. No forma parte de las migraciones ni se ejecuta al iniciar la aplicación.

Por defecto solo diagnostica. Requiere `--backup=ruta/al/archivo.dump`; verifica el SHA-256 del respaldo usando el manifiesto contiguo. Solo elimina datos cuando se agrega explícitamente `--apply`.

La operación usa una transacción, bloquea las tablas mientras trabaja, trunca una lista explícita sin `CASCADE`, conserva los identificadores consecutivos y verifica por hash que las tablas protegidas permanezcan iguales. Ante un error revierte la transacción. El informe no contiene contraseñas ni registros completos de usuarios.

No ejecutar `db:seed` para cargar la nueva información: ese comando vuelve a insertar los datos demo anteriores. La próxima carga debe prepararse como un conjunto de datos separado y revisado.
