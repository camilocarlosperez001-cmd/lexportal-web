# AGENTS.md — LexPortal

## Propósito y alcance

Estas instrucciones aplican a todo el repositorio. LexPortal conecta ciudadanos con abogados mediante búsqueda pública, verificación profesional, solicitudes de contacto y mensajería. La interfaz y los mensajes al usuario se escriben en español.

## Fuentes de verdad

Antes de implementar una funcionalidad, consultar:

1. `guia-casos-de-uso.md`: comportamiento esperado, actores, restricciones y alcance de cada CU/RF.
2. `supabase/migrations/`: contrato de datos versionado, relaciones, restricciones, permisos RLS, funciones, triggers y vistas. Leer las migraciones en orden; los cambios posteriores pueden modificar los anteriores. Su presencia no demuestra que estén aplicadas en un entorno remoto.
3. `src/types/supabase.ts`: tipos generados del contrato de Supabase. Contrastar con las migraciones cuando haya diferencias; no editar este archivo manualmente para simular capacidades inexistentes.
4. `stitch_lawyer_onboarding_wizard_ui/`: referencia visual de las pantallas (`code.html`, `screen.png`) y del sistema visual (`juris_corporate_design_system/DESIGN.md`). No define reglas de negocio ni amplía el alcance.

La guía determina lo que se necesita; el esquema determina lo que actualmente se puede persistir y consultar. Si un CU requiere algo que el esquema no soporta, identificar la brecha y resolver el contrato dentro del alcance de la tarea antes de presentar la función como terminada. No descartar el requisito ni inventar datos para ocultar la diferencia. Si la decisión de producto es ambigua, consultar solo esa decisión y avanzar con lo independiente.

## Stack y base existente

- React 19, TypeScript y Vite; aplicación web adaptable a móvil. La mención de móvil en la guía no implica crear otra aplicación nativa.
- Chakra UI 3 y Emotion para componentes y estilos. Utilizar la API de la versión instalada, sin copiar ejemplos de Chakra 2.
- `lucide-react` para nuevos iconos; no incorporar otra biblioteca de iconos. Los componentes auxiliares existentes pueden conservar sus dependencias actuales.
- Supabase JS 2 para Auth, datos, Storage y Realtime.
- Reutilizar el cliente tipado de `src/lib/supabase.ts`, los tipos de `src/types/supabase.ts` y los auxiliares existentes en `src/components/ui/`.
- `src/main.tsx` ya monta el `Provider` de Chakra. Evitar proveedores o clientes duplicados.
- Revisar `package.json` antes de elegir herramientas: actualmente no hay router, biblioteca de formularios, caché de consultas ni ejecutor de pruebas declarados. Incorporarlos solo cuando una tarea concreta los necesite; no asumir que están instalados.
- El chat base está en `src/features/mensajeria/components/ChatConversacion.tsx`, adaptado a Chakra 3 y con servicios separados. Aún requiere integración con sesión, rutas y validación de permisos reales.

## Estructura de carpetas objetivo

Organizar por funcionalidad. Este árbol define el destino de los archivos nuevos; crear cada carpeta cuando tenga contenido real. No mover toda la plantilla ni crear módulos vacíos solo para reproducir el árbol.

```text
/
├── AGENTS.md
├── guia-casos-de-uso.md
├── public/                         # Recursos estáticos servidos sin procesamiento
├── src/
│   ├── main.tsx                    # Arranque de React y proveedores globales
│   ├── App.tsx                     # Composición raíz; sin consultas de negocio
│   ├── index.css                   # Estilos globales mínimos
│   ├── app/
│   │   ├── routes.tsx              # Composición de rutas al incorporar navegación
│   │   ├── navigation.ts          # Opciones de menú por rol y funciones disponibles
│   │   └── guards/                 # Controles de sesión/rol para la navegación
│   ├── layouts/                    # Marcos público, autenticado y administrativo
│   ├── features/
│   │   ├── auth/                   # Registro, sesión y recuperación
│   │   ├── directorio/             # Búsqueda, filtros y consulta del perfil público
│   │   ├── perfil/                 # Alta profesional por pasos y edición del perfil
│   │   ├── solicitudes/            # Envío, seguimiento, decisiones y orientación
│   │   ├── mensajeria/             # Conversaciones y mensajes de texto
│   │   ├── cuenta/                 # Datos ordinarios de la cuenta
│   │   ├── privacidad/             # Aceptaciones, publicación y peticiones del titular
│   │   ├── notificaciones/         # Avisos internos y preferencias de correo
│   │   ├── catalogo/               # Áreas, tipos de caso, términos y administración
│   │   ├── verificacion/           # Revisiones iniciales y revalidación administrativa
│   │   └── indicadores/            # CU 14: solo al habilitar expresamente este alcance
│   ├── components/
│   │   ├── ui/                     # Auxiliares Chakra existentes y primitivas comunes
│   │   └── shared/                 # Estados vacíos, errores y componentes entre módulos
│   ├── hooks/                      # Hooks reutilizados por varias funcionalidades
│   ├── lib/
│   │   └── supabase.ts             # Única instancia del cliente del navegador
│   ├── theme/                      # Sistema Chakra, tokens y estilos semánticos
│   ├── types/
│   │   └── supabase.ts             # Tipos generados; conservar ubicación
│   ├── utils/                      # Funciones puras compartidas
│   └── assets/                     # Recursos importados desde React
├── supabase/
│   ├── migrations/                # Evolución SQL versionada
│   ├── functions/                 # Edge Functions; incluye enviar-correos
│   ├── templates/                 # Plantillas de correo de autenticación
│   ├── snippets/                  # Consultas auxiliares; no sustituyen migraciones
│   └── config.toml
└── stitch_lawyer_onboarding_wizard_ui/  # Referencias originales de diseño
```

Dentro de cada funcionalidad, usar únicamente las piezas necesarias:

```text
features/solicitudes/
├── pages/             # Pantallas que se conectan a rutas
├── components/        # Componentes exclusivos del módulo
├── hooks/             # Carga, acciones y estado de la funcionalidad
├── services/          # Consultas, mutaciones y RPC de Supabase
├── types.ts           # Tipos de formulario/presentación derivados del contrato
└── utils.ts           # Validaciones y transformaciones puras del módulo
```

- Las páginas componen componentes y hooks; los servicios concentran el acceso a Supabase. Evitar consultas dispersas en componentes visuales.
- Los módulos pueden consumir contratos o servicios explícitos de otro módulo; no importar sus páginas ni crear ciclos. Promover código a compartido solo cuando exista reutilización real.
- `auth` gestiona identidad y sesión; `perfil` gestiona los datos profesionales del registro por pasos; `privacidad` gestiona aceptaciones. Componer estas piezas sin duplicar sus reglas.
- La administración usa los mismos módulos de dominio bajo un layout y rutas autorizadas; no duplicar catálogo, privacidad o verificación en un segundo árbol de negocio.
- Componentes y páginas en PascalCase; hooks con prefijo `use`; carpetas en minúsculas sin tildes. Conservar nombres del esquema en las consultas y tipos.
- Mantener importaciones relativas mientras no se configure un alias coherente tanto en TypeScript como en Vite.
- Conservar `ChatConversacion.tsx` en `features/mensajeria/components/`. No mantener dos implementaciones.

## Mapa funcional y reglas de negocio

| Módulo | Casos de uso | Contratos principales existentes |
| --- | --- | --- |
| Auth y cuenta | CU 01, 02, 04, 12, 16 | Supabase Auth, `cuentas` |
| Perfil y directorio | CU 02, 05–08, 12 | `perfiles_abogados`, `perfil_area`, `perfil_tipo_caso`, RPC `buscar_abogados` |
| Verificación | CU 03, 18 | `versiones_profesionales`, `evidencias_privadas`, `revisiones_profesionales`, `politica_revalidacion` |
| Solicitudes | CU 09, 10, 20 | `solicitudes_contacto`, `orientaciones`, RPC `cambiar_estado_solicitud` |
| Mensajería | CU 11 | `conversaciones`, `mensajes_texto` |
| Notificaciones | CU 15 | `notificaciones`, preferencias en `cuentas`, función `enviar-correos` |
| Catálogo | CU 17 | `areas_juridicas`, `tipos_caso`, `area_tipo_caso`, `terminos_busqueda`, `termino_area`, `termino_tipo_caso` |
| Privacidad | CU 19; aceptaciones de CU 01 y 02 | `documentos_legales`, `aceptaciones_legales`, `solicitudes_privacidad` |
| Indicadores opcionales | CU 14 | Vistas `vista_indicadores_*`; comprobar permisos y capacidad de filtrar por periodo |

- La búsqueda es pública. El perfil consultable debe cumplir verificación, actividad y visibilidad; una nueva inscripción no equivale a aprobación.
- Mostrar únicamente campos cuya publicación esté autorizada. No exponer versiones, identificación o evidencias privadas como parte del perfil público. Un área declarada no acredita un título de especialización.
- Conservar la versión profesional aprobada mientras se revisan modificaciones verificables. Las decisiones y la revalidación deben conservar su trazabilidad.
- La solicitud pertenece a un ciudadano y se dirige a un abogado. Solo puede cancelarla el propietario mientras esté pendiente; solo el destinatario puede aceptarla o rechazarla mientras esté pendiente.
- Usar `cambiar_estado_solicitud` para las transiciones existentes y respetar los triggers. La aceptación habilita una conversación única; el cliente no debe crear otra ni resolver concurrencia únicamente con botones deshabilitados.
- El chat permite texto entre participantes de una solicitud aceptada. No incluye adjuntos ni acceso administrativo ordinario. No implica contratación ni garantía de resultados.
- La orientación permite una nueva búsqueda; no transfiere automáticamente solicitudes ni datos personales a otro abogado.
- Los avisos por correo deben ser genéricos y respetar preferencias. No incluir relatos, evidencias ni contenido de mensajes; conservar el aviso interno aunque falle el correo.
- Desactivar elementos del catálogo cuando corresponda, conservando referencias históricas. No ofrecer elementos inactivos para nuevas selecciones.
- Las peticiones de privacidad son procesos trazables. No prometer supresión instantánea de todo el historial ni establecer plazos de retención tomados del HTML.
- CU 13 (reseñas y valoraciones) está fuera de la primera versión. CU 14 es condicionado: la existencia de una pantalla o vista SQL no activa el módulo por sí sola.

## Cómo adaptar los diseños generados por IA

Antes de construir cada pantalla, asociar sus campos, acciones, filtros y enlaces con un CU y con un contrato real. Distinguir también los datos derivados que puedan calcularse de forma verificable. Si un elemento no tiene respaldo, omitirlo o sustituirlo por una acción real del alcance; no mostrar controles ficticios.

Ejemplos encontrados en las referencias:

- Omitir agenda y citas, expedientes judiciales, pagos, facturación, contratos automáticos y salas de videollamada. No están autorizados por la guía actual.
- Sustituir «Agendar consulta» por el flujo de solicitud de contacto cuando corresponda. Aceptar una solicitud habilita chat, no genera una cita ni un contrato.
- Omitir estrellas, testimonios y reseñas de la primera versión, aunque aparezcan en el perfil HTML.
- Una modalidad o tarifa orientativa almacenada es información descriptiva, no una funcionalidad de videollamada o cobro.
- No convertir automáticamente «Mis casos» en gestión de expedientes: la entidad disponible es la solicitud de contacto.
- No copiar personas, cifras, matrículas, supuestos indicadores, porcentajes de éxito, estados «en línea» ni promesas legales de los ejemplos como datos reales.
- No trasladar referencias legales ni plazos de conservación del HTML a la aplicación sin un contenido validado para el proyecto.

Reconstruir las vistas con React, Chakra UI 3 y Lucide. No importar páginas HTML completas, scripts inline, manejadores `onclick`, Tailwind por CDN o Material Symbols. Preservar los originales como referencia.

Centralizar colores, tipografía, espaciado y radios en `src/theme/`. Tomar `DESIGN.md` y las pantallas como referencia estética; si sus valores difieren, adoptar una decisión consistente en tokens, sin multiplicar paletas por pantalla. Conectar el sistema al `Provider` existente. Mantener CSS global mínimo y retirar estilos de demostración cuando interfieran con la pantalla que se implementa.

Usar etiquetas accesibles, navegación por teclado, foco visible, mensajes de validación asociados y nombres accesibles para botones con iconos. Verificar móvil y escritorio. Toda consulta o acción debe contemplar carga, error, vacío, éxito y falta de permiso cuando aplique. No representar errores de red como listas vacías o contadores en cero.

## Datos, permisos y seguridad

- Derivar tipos de `Database`, `Tables`, `TablesInsert`, `TablesUpdate` y `Enums`; usar `import type` cuando corresponda. No usar `any` ni conversiones forzadas para eludir diferencias con el esquema. Validar los campos JSON antes de consumirlos como estructuras de presentación.
- Consultar columnas necesarias y separar modelos públicos de privados. RLS filtra filas; no asumir que por sí sola oculta columnas privadas ni que una función `SECURITY DEFINER` hereda todas sus restricciones.
- Las rutas y menús por rol mejoran la experiencia, pero la autorización debe existir también en la base de datos o en funciones de servidor. No confiar en parámetros del navegador para asignar privilegios administrativos.
- Reutilizar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Las variables `VITE_*` son públicas: nunca introducir claves `service_role`, secretos de correo o credenciales de servidor en ellas, en el código cliente o en logs.
- Al cargar evidencias, usar el bucket privado `evidencias-privadas` y rutas bajo el identificador del titular conforme a sus políticas. El contrato actual admite PDF, JPEG y PNG, hasta 10 MB. El acceso de lectura requiere autorización; no generar enlaces públicos permanentes.
- En Realtime, filtrar por conversación, limpiar suscripciones al desmontar o cambiar de sesión y evitar mensajes duplicados por historial/eventos. Manejar errores de envío y conexión sin afirmar éxito antes de la confirmación.
- No persistir relatos, evidencias, contraseñas o mensajes en almacenamiento local ni registrarlos en logs. Los datos de demostración pertenecen a fixtures explícitos o entornos de prueba, nunca a un fallback que simule una respuesta real.
- Preparar nuevas migraciones para cambios de esquema; no reescribir el historial aplicado ni modificar manualmente tipos generados. Actualizar tipos desde el esquema correspondiente y comprobar las políticas afectadas. No aplicar migraciones a un entorno remoto salvo que forme parte de la tarea autorizada.

## Flujo de trabajo y validación

1. Leer el CU aplicable, los archivos existentes del módulo, los tipos y las migraciones relevantes.
2. Identificar el contrato de datos, permisos y transiciones; contrastar la pantalla de referencia y omitir sus elementos fuera del alcance.
3. Implementar el cambio en el módulo correspondiente, reutilizando componentes y servicios. Evitar reorganizaciones o dependencias ajenas a la tarea.
4. Para cambios de código, ejecutar los comandos existentes: `npm run lint` y `npm run build`. `npm run dev` sirve para revisión interactiva y `npm run preview` para revisar la compilación.
5. Comprobar el flujo afectado con sus roles, estados vacíos, fallos y restricciones. Si se cambia seguridad o SQL, verificar también el rechazo a usuarios ajenos y las transiciones concurrentes pertinentes; compilar el frontend no valida RLS.
6. Añadir pruebas cuando protejan reglas relevantes y exista o se incorpore la infraestructura necesaria. No afirmar que existe `npm test`: actualmente no está definido. Para cambios solo documentales, revisar rutas, coherencia y formato sin exigir compilación.
7. Informar qué cambió, qué se verificó y qué quedó pendiente. Distinguir fallos previos de los introducidos; no declarar comprobaciones exitosas sin ejecutarlas.

Una funcionalidad queda terminada cuando satisface su CU con datos y permisos reales, tiene navegación funcional y estados de interfaz completos, y no depende de contenido ficticio procedente del diseño.
