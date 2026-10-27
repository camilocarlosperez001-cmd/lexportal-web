# Auth HTTPS para web y app

Actualizado el 27/10/2026. Dominio `https://lexportal-web.vercel.app`; paquete/bundle móvil `com.lexportal.mobile`.

La web ya se publicó con el commit `91b52d2` y las plantillas Auth Cloud se activaron después. No requiere cambiar llamadas a tablas/RPC.

## Mantener en web

- `src/domain/authLinks.ts`: mismo contrato puro que móvil; admite token_hash en fragmento (preferido) o query. Valida el propósito declarado, duplicados y mezcla de credenciales. Limpia credenciales y no interpreta `next`.
- `useAuthEmailLink`: intercambio `verifyOtp` una vez, incluso con StrictMode. Confirmación usa `email`; recuperación usa `recovery`. No mostrar mensajes arbitrarios del enlace ni tokens. El SDK conserva su detección de fragmentos antiguos access_token/refresh_token.
- `/auth/callback`: espera la identidad de la nueva sesión antes de confirmar. `/recuperar-password`: el error o intercambio pendiente manda sobre una sesión que ya existía.
- `public/.well-known/assetlinks.json`: huella pública real del certificado EAS Android. Al usar Play App Signing añadir también su certificado de firma de app; conservar los certificados de versiones vigentes.
- `vercel.json`: JSON sin redirecciones para asociaciones; `.well-known` fuera del fallback SPA. Callbacks con no-referrer y no-store.

## Plantillas de Supabase Cloud

Las plantillas versionadas viven en `supabase/templates/` de este workdir y se declaran en `supabase/config.toml`:

```html
<!-- Confirmación -->
{{ .SiteURL }}/auth/callback#token_hash={{ .TokenHash }}&amp;type=email
<!-- Recuperación -->
{{ .SiteURL }}/recuperar-password#token_hash={{ .TokenHash }}&amp;type=recovery
```

El primer enlace del correo debe pertenecer al dominio asociado; ConfirmationURL pasa primero por Supabase y su redirect no sustituye los enlaces verificados. Los fragmentos no se envían a Vercel. Los enlaces son credenciales temporales y no deben registrarse ni compartirse.

Site URL y las ocho URLs autorizadas se conservaron. SMTP se resuelve mediante env de servidor; no hay secretos nuevos en el cliente. Ejecutar config diff antes de config push con el workdir correcto. La CLI trata el HTML como contenido adicional al diff de asuntos; verificar también los cuerpos remotos y un segundo push sin cambios. Las plantillas locales de la raíz permanecen como antes. Mantener compatibilidad con enlaces ya emitidos.

## iOS pendiente

El usuario tiene Expo pero no Apple Developer. `associatedDomains` y bundleIdentifier están preparados en móvil; falta Team ID real, AASA y build iOS firmado. No publicar archivo de ejemplo. Desde el repositorio móvil se podrá ejecutar `node scripts/write-apple-association.cjs TEAMIDREAL "C:/Users/Luis/Documents/Frontend"`, publicar el archivo y construir iOS con ese mismo equipo. Mientras tanto AASA responde 404, no HTML 200.

## Datos heredados

Las dos migraciones adicionales de datos se anunciaron antes de aplicar y se ensayaron con rollback. La primera normaliza NULL a cadena vacía en cuatro campos internos de Auth; conserva tokens presentes. La segunda completa fechas Auth ausentes desde `cuentas.creada_en`, usando esa base histórica cuando tampoco existía updated_at; no inventa una modificación histórica. Cada una compara las demás columnas en la transacción y cancela si cambian. Respaldo privado en `.local-backups/auth-links-2026-10-27` del repositorio móvil. Los dos hashes de contraseña ausentes se conservan ausentes, igual que metadatos/roles/confirmaciones. No hay schema, tabla, RPC, bucket o política nuevos.

Auth volvió a listar los 20 usuarios actuales; la importación original tenía 19 y se preservó la alta posterior. La cuenta temporal de las pruebas se eliminó. Las pruebas API confirmaron token_hash/email, recuperación/cambio de contraseña y rechazo de reuso, comparando los UUID antes/después. No se enviaron correos reales. Confirmar el comportamiento físico Android con un APK propio: Expo Go no posee la asociación. iOS requiere completar los requisitos anteriores.

Más detalle en `docs/auth-app-links.md` del repositorio móvil y [Expo App Links](https://docs.expo.dev/linking/android-app-links/).
