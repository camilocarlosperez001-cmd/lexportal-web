# LexPortal · aplicación web

Portal que conecta ciudadanos con abogados: búsqueda pública, verificación profesional,
solicitudes de contacto y mensajería. Interfaz en español, adaptable a móvil.

## Requisitos

- Node.js 20.19+ o 22.12+ (requisito de Vite 8)
- npm
- Un proyecto de Supabase

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completa tus valores
npm run dev
```

Variables necesarias en `.env.local`:

| Variable | Descripción |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima (pública por diseño; RLS protege los datos) |

`.env.local` no se versiona. Nunca uses `service_role` ni secretos de correo en variables
`VITE_*`: se incluyen en el paquete del navegador.

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run lint` | Análisis estático con ESLint |
| `npm run build` | Verificación de tipos y compilación a `dist/` |
| `npm run preview` | Sirve la compilación local |

No hay ejecutor de pruebas configurado.

## Base de datos

El contrato versionado está en `supabase/migrations/` y las funciones de correo en
`supabase/functions/`. Su presencia no implica que estén aplicadas en un entorno remoto.

```bash
npx supabase login
npx supabase link --project-ref <ref-del-proyecto>
npx supabase db push
```

El estado local del CLI (`supabase/.temp/`, `supabase/.branches/`) no se versiona.

## Despliegue en Vercel

1. Importa este repositorio como proyecto en Vercel.
2. Define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en *Environment Variables*
   para Production, Preview y Development.
3. Vercel detecta Vite: compilación `npm run build`, salida `dist/`.
4. `vercel.json` reescribe las rutas a `index.html` para que los enlaces profundos de
   React Router funcionen al recargar.

## Documentación del proyecto

- `guia-casos-de-uso.md`: comportamiento esperado y alcance de cada caso de uso.
- `AGENTS.md`: convenciones de arquitectura, datos, permisos y validación.
- `stitch_lawyer_onboarding_wizard_ui/`: referencias visuales de las pantallas.
