# Guía de casos de uso

Especificaciones del comportamiento esperado de la aplicación web y móvil. Los códigos CU conservan la correspondencia con los requisitos RF. RF 13 queda reservado para una versión posterior y RF 14 se implementará según recursos.

##### CU 01 Registro de ciudadano

**Requisito asociado:** RF 01 y RF 19.

**Actor y objetivo:** Visitante que desea obtener una cuenta de ciudadano.

**Precondiciones:** No disponer de una cuenta con el mismo correo; tener acceso al formulario de registro.

**Flujo principal:** 1) Seleccionar el registro de ciudadano. 2) Ingresar nombre completo, correo y contraseña; aportar teléfono si lo desea. 3) Consultar y aceptar términos y autorización de tratamiento de datos. 4) Enviar el formulario. 5) El sistema valida los datos y registra la cuenta y las aceptaciones.

**Alternativas y excepciones:** Datos incompletos o inválidos: se solicita corrección. Correo ya registrado: se informa y no se crea otra cuenta. Falta de aceptación requerida: no se completa el registro.

**Resultado esperado:** Cuenta de ciudadano creada y fecha y versión de las aceptaciones conservadas. La búsqueda pública continúa disponible sin registro.

##### CU 02 Registro de abogado

**Requisito asociado:** RF 02 y RF 19.

**Actor y objetivo:** Visitante que solicita una cuenta profesional.

**Precondiciones:** Disponer de los datos de identificación, contacto y tarjeta profesional y de información para describir su práctica.

**Flujo principal:** 1) Seleccionar el registro de abogado. 2) Ingresar datos requeridos, áreas, tipos de caso, experiencia y descripción. 3) Diferenciar campos públicos de información privada de verificación. 4) Registrar las aceptaciones correspondientes. 5) El sistema crea cuenta, perfil y presentación de datos verificables.

**Alternativas y excepciones:** Datos incompletos o inconsistentes: se solicita corrección. Correo ya utilizado: no se duplica la cuenta. Un registro pendiente no aparece como perfil aprobado.

**Resultado esperado:** Cuenta y perfil registrados, pendientes de revisión administrativa; las evidencias no se publican.

##### CU 03 Verificación profesional

**Requisito asociado:** RF 03.

**Actor y objetivo:** Administrador autorizado; abogado como destinatario de la decisión.

**Precondiciones:** Existir una presentación de información profesional pendiente de revisión y acceso administrativo a sus evidencias.

**Flujo principal:** 1) Consultar la versión y las evidencias privadas. 2) Realizar la consulta en la fuente oficial definida. 3) Registrar fuente, resultado y fecha de consulta. 4) Decidir aprobación, correcciones o rechazo. 5) Registrar fecha, responsable, alcance y motivo. 6) Comunicar el resultado al abogado.

**Alternativas y excepciones:** Información insuficiente: solicitar correcciones. Incumplimiento de criterios: rechazar la verificación. Si la consulta oficial no puede completarse, se documenta la situación y no se presupone un resultado favorable.

**Resultado esperado:** Decisión trazable. Solo una aprobación que cumpla las demás condiciones de actividad permite publicación; se muestra su fecha y alcance.

##### CU 04 Autenticación y acceso por rol

**Requisito asociado:** RF 04.

**Actor y objetivo:** Ciudadano, abogado o administrador.

**Precondiciones:** Cuenta registrada y credenciales disponibles para iniciar sesión.

**Flujo principal:** 1) Ingresar correo y contraseña. 2) El sistema valida la identidad. 3) Se establece una sesión y se presentan las funcionalidades del rol. 4) Cada operación protegida comprueba el permiso correspondiente. 5) El usuario puede cerrar la sesión.

**Alternativas y excepciones:** Credenciales inválidas: se deniega el acceso. Sesión vencida: se exige nueva autenticación. Intento de una operación ajena al rol: se rechaza sin alterar datos.

**Resultado esperado:** Sesión válida con acceso autorizado o sesión finalizada por cierre o vencimiento conforme a la política definida.

##### CU 05 Búsqueda de abogados

**Requisito asociado:** RF 05.

**Actor y objetivo:** Visitante o usuario autenticado.

**Precondiciones:** Disponer del catálogo y de la consulta pública de perfiles; no se exige cuenta.

**Flujo principal:** 1) Ingresar nombre, área o término asociado a una situación jurídica. 2) Ejecutar la búsqueda. 3) El sistema combina el texto con los filtros seleccionados. 4) Presentar perfiles que cumplan las condiciones de verificación, actividad y visibilidad.

**Alternativas y excepciones:** Sin coincidencias: mostrar un aviso y permitir reformular la búsqueda. Perfiles pendientes, rechazados o suspendidos: no se incorporan a los resultados públicos.

**Resultado esperado:** Listado de perfiles disponibles o aviso de ausencia de resultados, sin mostrar evidencias privadas.

##### CU 06 Filtrado por área jurídica

**Requisito asociado:** RF 06.

**Actor y objetivo:** Visitante o usuario autenticado.

**Precondiciones:** Encontrarse en la búsqueda y disponer de áreas seleccionables del catálogo.

**Flujo principal:** 1) Seleccionar una o varias áreas jurídicas. 2) Mantener o modificar el texto y el filtro por tipo de caso. 3) El sistema aplica los criterios combinados. 4) Actualizar los resultados.

**Alternativas y excepciones:** No hay perfiles con la combinación elegida: informar la ausencia de coincidencias. El usuario elimina o modifica filtros para repetir la consulta.

**Resultado esperado:** Resultados ajustados a las áreas seleccionadas y a los demás criterios activos, conservando el requisito de perfil verificado.

##### CU 07 Filtrado por tipo de caso

**Requisito asociado:** RF 07.

**Actor y objetivo:** Visitante o usuario autenticado.

**Precondiciones:** Disponer de tipos de caso activos y sus relaciones con áreas jurídicas.

**Flujo principal:** 1) Seleccionar una situación en lenguaje cotidiano. 2) Combinarla con texto y áreas si se requiere. 3) El sistema identifica perfiles que declararon atender ese tipo de caso. 4) Mostrar los resultados.

**Alternativas y excepciones:** No existen abogados disponibles para el criterio: informar y permitir cambiarlo. Una situación desactivada no se ofrece como nueva selección.

**Resultado esperado:** Perfiles verificados que declaran atender la situación consultada, conforme a la correspondencia del catálogo.

##### CU 08 Consulta de perfil público

**Requisito asociado:** RF 08.

**Actor y objetivo:** Visitante o usuario autenticado.

**Precondiciones:** Seleccionar un perfil que cumpla las condiciones de consulta pública.

**Flujo principal:** 1) Abrir el perfil. 2) Consultar nombre profesional, áreas, casos, experiencia, descripción y ciudad. 3) Consultar estado, fecha y alcance de verificación. 4) Mostrar los campos opcionales que el abogado haya autorizado publicar.

**Alternativas y excepciones:** Perfil que dejó de ser visible: comunicar que no está disponible para consulta pública. Campos opcionales no autorizados: omitirlos.

**Resultado esperado:** Presentación de información pública sin copias de identidad ni acreditaciones privadas y sin atribuir especializaciones académicas a áreas declaradas.

##### CU 09 Solicitud y seguimiento de contacto

**Requisito asociado:** RF 09.

**Actor y objetivo:** Ciudadano autenticado; abogado como destinatario.

**Precondiciones:** Sesión de ciudadano válida y selección de un abogado disponible para contacto.

**Flujo principal:** 1) Abrir el formulario. 2) Seleccionar tipo de caso o «No sé cómo clasificar mi caso». 3) Escribir descripción breve y ayuda buscada. 4) Enviar. 5) El sistema registra fecha y estado pendiente. 6) El ciudadano consulta el estado desde su cuenta.

**Alternativas y excepciones:** Sesión ausente: solicitar autenticación. Datos incompletos: pedir corrección. Cancelación solicitada por el propietario mientras sigue pendiente: registrar estado cancelado y fecha. Si ya existe decisión, no permitir cancelar.

**Resultado esperado:** Solicitud vinculada al ciudadano y al abogado con estado consultable; la cancelación válida genera el aviso correspondiente.

##### CU 10 Gestión de solicitudes por el abogado

**Requisito asociado:** RF 10.

**Actor y objetivo:** Abogado autenticado; ciudadano como destinatario de la respuesta.

**Precondiciones:** Solicitud dirigida al perfil del abogado y todavía pendiente.

**Flujo principal:** 1) Consultar las solicitudes recibidas. 2) Abrir una solicitud. 3) Aceptarla o rechazarla. 4) El sistema verifica actor y estado. 5) Registrar decisión y fecha. 6) Notificar al ciudadano. En aceptación, habilitar una conversación única.

**Alternativas y excepciones:** Rechazo: permitir motivo general y orientación opcional. Solicitud cancelada o ya decidida: impedir otra transición e informar el estado vigente. Intento de otro abogado: denegar acceso.

**Resultado esperado:** Estado aceptado o rechazado registrado. El chat se habilita únicamente al aceptar; una decisión simultánea no produce dos estados finales.

##### CU 11 Mensajería interna

**Requisito asociado:** RF 11.

**Actor y objetivo:** Ciudadano y abogado participantes de una solicitud aceptada.

**Precondiciones:** Solicitud aceptada, conversación habilitada y sesión de uno de sus participantes.

**Flujo principal:** 1) Abrir la conversación autorizada. 2) Consultar historial disponible. 3) Escribir y enviar texto. 4) El sistema valida participación y registra autor y fecha. 5) El otro participante recibe la actualización o aviso.

**Alternativas y excepciones:** Solicitud sin aceptación: no habilitar chat. Usuario ajeno o administrador en acceso ordinario: denegar consulta del chat. Intento de adjuntar archivos: funcionalidad fuera del alcance.

**Resultado esperado:** Texto conservado y consultable por participantes conforme a retención; el intercambio no implica contratación ni resultado jurídico.

##### CU 12 Actualización de cuenta y perfil

**Requisito asociado:** RF 12.

**Actor y objetivo:** Ciudadano o abogado autenticado.

**Precondiciones:** Sesión válida y titularidad de la cuenta o perfil a modificar.

**Flujo principal:** 1) Abrir edición. 2) Modificar datos permitidos para el rol. 3) Enviar cambios. 4) El sistema valida y actualiza campos ordinarios. 5) Si el cambio afecta identidad o habilitación profesional, registrar una nueva presentación para revisión.

**Alternativas y excepciones:** Datos inválidos: pedir corrección. Modificación de datos verificables: mantener la información aprobada hasta que la revisión correspondiente decida sobre la nueva versión.

**Resultado esperado:** Cuenta o perfil actualizado conforme al tipo de dato; la información validada no se sustituye automáticamente por un cambio no revisado.

##### CU 13 Valoraciones y moderación de reseñas

**Requisito asociado:** RF 13 — versión posterior.

**Actor y objetivo:** Ciudadano para valoración y reporte; administrador para revisión.

**Precondiciones:** En una versión futura: solicitud aceptada con intercambio de mensajes y ausencia de una valoración previa del mismo contacto.

**Flujo principal:** 1) Registrar valoración y reseña de la experiencia de contacto. 2) Vincularlas internamente con autor y solicitud. 3) Publicar sin mostrar la identidad del ciudadano. 4) Permitir reporte o solicitud de revisión. 5) El administrador registra una decisión de mantener, ocultar o retirar.

**Alternativas y excepciones:** Solicitud sin mensajes o con valoración ya registrada: no admitir otra valoración. Reseña reportada: realizar la revisión y conservar la decisión administrativa.

**Resultado esperado:** Una valoración por contacto elegible y moderación trazable. No se presenta como evidencia de contratación ni de resultados jurídicos. Caso excluido de la primera versión.

##### CU 14 Consulta de indicadores administrativos

**Requisito asociado:** RF 14 — implementación condicionada.

**Actor y objetivo:** Administrador autenticado.

**Precondiciones:** Módulo implementado según recursos y permiso administrativo válido.

**Flujo principal:** 1) Seleccionar periodo. 2) Consultar cuentas por rol, perfiles por estado de verificación y contactos por estado. 3) El sistema obtiene y presenta valores agregados.

**Alternativas y excepciones:** Periodo sin registros: informar valores sin datos disponibles. Usuario sin permiso: denegar consulta. Si el módulo no se implementa, se conserva fuera de las funciones disponibles.

**Resultado esperado:** Reporte agregado del periodo, sin relatos de casos ni contenido de conversaciones.

##### CU 15 Notificaciones y preferencias

**Requisito asociado:** RF 15.

**Actor y objetivo:** Usuarios autenticados; eventos del sistema como desencadenantes de avisos.

**Precondiciones:** Cuenta destinataria identificada y evento notificable; para configurar preferencias, sesión del titular.

**Flujo principal:** 1) El sistema registra un aviso por nueva solicitud, decisión, cancelación, mensaje o verificación. 2) El destinatario consulta sus notificaciones. 3) Accede al recurso mediante autorización. 4) Configura si desea avisos por correo.

**Alternativas y excepciones:** Correo deshabilitado: conservar únicamente el aviso interno. Recurso privado: exigir autenticación y permiso al abrirlo. Fallo de envío externo: la notificación interna permanece registrada y el tratamiento del fallo se concreta en implementación.

**Resultado esperado:** Aviso interno disponible y preferencia conservada. El correo permitido es genérico y no incluye relato, documentos ni texto de mensajes.

##### CU 16 Recuperación de acceso

**Requisito asociado:** RF 16.

**Actor y objetivo:** Titular de una cuenta que necesita restablecer su contraseña.

**Precondiciones:** Correo registrado y acceso al buzón correspondiente.

**Flujo principal:** 1) Solicitar recuperación indicando el correo. 2) Enviar enlace temporal de un solo uso. 3) Abrir enlace válido. 4) Definir nueva contraseña. 5) Completar restablecimiento e invalidar el enlace utilizado. 6) Iniciar sesión con la nueva contraseña.

**Alternativas y excepciones:** Enlace vencido o utilizado: rechazar restablecimiento y permitir solicitar otro. Contraseña no válida según la política definida: solicitar corrección.

**Resultado esperado:** Acceso recuperable con nueva contraseña; no se registra cambio a partir de un enlace inválido.

##### CU 17 Administración del catálogo jurídico

**Requisito asociado:** RF 17.

**Actor y objetivo:** Administrador autenticado.

**Precondiciones:** Permiso para gestionar áreas, tipos de caso, términos y relaciones.

**Flujo principal:** 1) Consultar catálogo. 2) Crear o editar un elemento. 3) Establecer relaciones entre áreas, situaciones y términos. 4) Validar correspondencia. 5) Guardar o desactivar elementos cuando proceda.

**Alternativas y excepciones:** Datos incoherentes: solicitar corrección. Elemento con referencias históricas: desactivar sin borrarlas. Los elementos desactivados no se ofrecen en nuevos registros.

**Resultado esperado:** Catálogo actualizado y relaciones conservadas, sin alterar la clasificación histórica de contactos existentes.

##### CU 18 Revalidación profesional

**Requisito asociado:** RF 18.

**Actor y objetivo:** Administrador; abogado como destinatario de requerimientos.

**Precondiciones:** Perfil previamente verificado y periodicidad configurada para revisión.

**Flujo principal:** 1) Programar revisión. 2) Consultar información al llegar la fecha. 3) Solicitar actualización de evidencias si es necesaria. 4) Registrar resultado, responsable y decisión. 5) Actualizar referencia de verificación o suspender visibilidad cuando deje de cumplir criterios. 6) Comunicar resultado y motivo de suspensión.

**Alternativas y excepciones:** Evidencia insuficiente: requerir actualización. Incumplimiento detectado: suspender la aparición pública. La mera presentación de una nueva versión no reemplaza automáticamente los datos validados.

**Resultado esperado:** Revisión trazable y estado de visibilidad coherente con los criterios definidos; el historial se conserva.

##### CU 19 Privacidad de cuenta y perfil

**Requisito asociado:** RF 19.

**Actor y objetivo:** Ciudadano o abogado titular; administrador para resolución.

**Precondiciones:** Identificación del titular para su gestión de privacidad; permiso administrativo para resolver peticiones.

**Flujo principal:** 1) Conservar fecha y versión de términos y autorizaciones. 2) El abogado configura qué campos opcionales publica. 3) El titular registra una petición de desactivación o supresión. 4) Consulta su estado. 5) El administrador evalúa la política aplicable, registra medidas y resolución y comunica respuesta.

**Alternativas y excepciones:** Campo opcional no autorizado: excluir de la presentación pública. Supresión con información sujeta a conservación: documentar el tratamiento y responder conforme a la política, sin prometer borrado automático de todo el historial.

**Resultado esperado:** Preferencias de publicación y petición trazables, con resolución y respuesta; la gestión no otorga acceso ordinario al contenido del chat.

##### CU 20 Orientación hacia otra clasificación jurídica

**Requisito asociado:** RF 20.

**Actor y objetivo:** Abogado destinatario; ciudadano que recibe orientación.

**Precondiciones:** Solicitud dirigida al abogado y acceso autorizado a su consulta.

**Flujo principal:** 1) El abogado identifica que el asunto no corresponde a su práctica. 2) Recomienda área o tipo de caso y, si procede, un comentario general. 3) El sistema registra la orientación. 4) El ciudadano la consulta. 5) Puede iniciar una nueva búsqueda usando la recomendación.

**Alternativas y excepciones:** Sin una clasificación concreta disponible: conservar orientación general cuando corresponda. La recomendación no envía la solicitud a otro abogado ni reemplaza una decisión sobre su estado.

**Resultado esperado:** Orientación disponible para una búsqueda nueva, sin transferencia automática del relato ni de datos personales.


