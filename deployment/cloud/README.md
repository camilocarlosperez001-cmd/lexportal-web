# Supabase Cloud de LexPortal

Destino: `kpksbvvzbjsugnxgphdw`. Migración inicial realizada el 27 de octubre de 2026 desde el estado local auditado. Web: https://lexportal-web.vercel.app.

Desde el 28/10/2026 la web canónica es https://lexportal.app. Ver [actualización de dominio](domain-change.md). Los callbacks anteriores se conservan; las URLs se actualizaron con una configuración mínima, sin cambiar el SMTP Hostinger que el usuario configuró. No usar las credenciales locales antiguas para aplicar este cambio.

Este directorio es la fuente de despliegue **Cloud**. El `supabase/` de la raíz conserva el historial local original (42 archivos, solo 11 registrados) y la función local anterior. No ejecutar sus migraciones pendientes contra producción ni desplegar desde allí `enviar-correos`: se perdería la protección de servidor añadida en Cloud.

## Historial de producción

- `20261027173000_cloud_baseline.sql`: esquema activo sin seeds/datos/credenciales; conserva tablas, funciones/RPC, RLS, trigger propio de Auth, políticas Storage y Realtime. El correo existente lee su endpoint y secreto desde Vault. Los triggers privilegiados tienen search_path fijo. La programación se crea inicialmente desactivada para permitir una importación segura.
- `20261027174000_restaurar_permisos_origen.sql`: reproduce las ACL originales. Es necesaria porque los defaults de Cloud añaden grants explícitos a anon/authenticated que un `REVOKE ... FROM PUBLIC` por sí solo no elimina.

Las dos versiones iniciales están registradas en Cloud. Se añadieron y aplicaron `20261027184500_normalizar_campos_auth_heredados.sql` y `20261027185000_restaurar_fechas_auth_heredadas.sql`: corrigen solo campos internos/fechas nulos de tres usuarios heredados, conservando contraseñas, roles, identidades y demás columnas. Ver [detalle de enlaces y corrección Auth](auth-app-links.md). El historial original está archivado en los respaldos locales de migración; no se marcó indiscriminadamente como aplicado. Mantener los archivos existentes y crear nuevas migraciones aquí para evolucionar producción. No repetir la baseline sobre un proyecto con datos.

Usar la CLI desde este workdir:

```powershell
# Desde la raíz de Frontend, después de iniciar sesión:
npx supabase link --project-ref kpksbvvzbjsugnxgphdw --workdir deployment/cloud
npx supabase migration list --workdir deployment/cloud
npx supabase db push --dry-run --workdir deployment/cloud
# Revisar migraciones, respaldo y pruebas antes del db push real.
```

El vínculo local de la CLI no se versiona. La importación se ejecutó con destino explícito mediante Management API y transacciones; no se cambió el vínculo del repositorio local de desarrollo.

## Correo, Auth y secretos

La función existente se despliega desde `supabase/functions/enviar-correos` de **este** directorio. `verify_jwt=false` es intencional porque su comprobación propia requiere el header de servidor `x-lexportal-webhook-secret`; los JWT de usuarios no autorizan envíos. El payload solo identifica la fila: la función relee de la base destinatario, evento, estado y preferencia, y no reenvía estados finales. No desplegar la versión antigua sin esa guardia.

- Secretos Edge: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, LEXPORTAL_WEBHOOK_SECRET.
- Vault: `lexportal_mail_webhook_secret` (mismo valor) y `lexportal_mail_endpoint` (URL HTTPS de la función).
- Las claves automáticas SUPABASE_* son del destino; no copiar claves locales.
- SMTP de Auth está configurado por separado, con el mismo proveedor/remitente previamente usado en local. Las variables `env(SMTP_*)` del config versionado deben resolverse únicamente en un entorno seguro de despliegue.

Antes de cambiar configuración, ejecutar `supabase config diff --project-ref ... --workdir deployment/cloud` con el entorno de servidor adecuado y revisar qué propiedades cambiarían. Nunca introducir secretos SMTP en VITE_* ni incluir credenciales literales en SQL. Para nuevas funciones privilegiadas, revisar grants explícitos de anon/authenticated además de PUBLIC.

## Conservación y operación

Se importaron 19 usuarios/cuentas, 10 perfiles, datos relacionados y los 22 archivos de los tres buckets. Los IDs y hashes de Auth se conservaron; las sesiones/enlaces locales no se convierten en sesiones/enlaces Cloud. Los objetos mantuvieron rutas/bytes; sus IDs y fechas internas de Storage son nuevos, con metadatos originales archivados. No se eliminaron las fotografías anteriores ni los archivos sin referencia vigente.

Se actualizaron solo las tres URLs legales al host Cloud, sin cambiar contenido, versión, fechas ni aceptaciones. Se mantuvieron privadas las evidencias y fotografías. Los futuros uploads usan cuenta/foto/perfil/archivo.

Cron `revalidacion_diaria_perfiles` está activo en Cloud y pausado en local para evitar ejecuciones duplicadas. Un proyecto reconstruido con la baseline requiere activar cron después de cargar/verificar sus datos y configurar el correo. No reenviar avisos históricos pendientes o fallidos automáticamente.

El frontend Vercel ya utiliza la URL/clave pública Cloud; no se requieren cambios en sus llamadas RPC por esta migración. `src/types/supabase.ts` de la raíz se regeneró desde Cloud. No se cambió el `.env.local` del frontend, que mantiene el entorno local de desarrollo.

Pruebas: ensayo Cloud con rollback y huellas de 31 tablas; 9 suites SQL con rollback; API real de directorio, fotografías autorizadas, bloqueo de evidencias, login de una cuenta temporal, RLS y rechazo de RPC administrativa; fixture retirado, 19 cuentas originales conservadas; 22 descargas Cloud verificadas SHA-256. No se enviaron correos reales ni se probó un dispositivo físico en esta tarea: comprobar confirmación, recuperación y avisos con una cuenta propia.

El informe y respaldos restringidos se encuentran en el repositorio móvil: `docs/supabase-cloud-migration.md` y `.local-backups/cloud-preparation-2026-10-27T17-09-50-209Z`. Los respaldos nunca deben subirse a Git/Vercel ni a buckets públicos.
