import { authorizedWebhook, webhookNotificationId } from "./webhook.ts";
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import nodemailer from "npm:nodemailer";
import { createClient } from "npm:@supabase/supabase-js@2";

// Configuración de SMTP a partir de las variables de entorno. En local la función se
// sirve indicando el archivo de variables en la raíz del proyecto:
//   supabase functions serve enviar-correos --env-file .env.local
// Es el mismo archivo que lee Vite para el front; solo las variables VITE_* son
// públicas y llegan al navegador, el resto queda en el servidor.
const transporter = nodemailer.createTransport({
  host: Deno.env.get("SMTP_HOST"),
  port: parseInt(Deno.env.get("SMTP_PORT") || "465"),
  secure: true, // true para puerto 465, false para 587
  auth: {
    user: Deno.env.get("SMTP_USER"),
    pass: Deno.env.get("SMTP_PASS"),
  },
});

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!authorizedWebhook(req.headers.get('x-lexportal-webhook-secret'), Deno.env.get('LEXPORTAL_WEBHOOK_SECRET'))) {
    return new Response('Unauthorized', { status: 401 });
  }
  // Fuera del try para poder registrar el fallo aunque ocurra más adelante.
  let notificacionId: string | null = null;
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  /**
   * Deja constancia del desenlace en `avisos_correo_diagnostico`, la misma tabla donde
   * el trigger anota el encolado. Así el motivo de un fallo se consulta por SQL, sin
   * depender de la terminal de la función. Nunca debe interrumpir el envío.
   */
  async function registrarDesenlace(
    id: string | null,
    resultado: "entregado" | "no_aplica" | "error",
    detalle?: string,
  ): Promise<void> {
    if (!id) return;
    try {
      await supabaseAdmin
        .from("avisos_correo_diagnostico")
        .insert({ notificacion_id: id, resultado, detalle: detalle?.slice(0, 500) ?? null });
    } catch (fallo) {
      console.error("No se pudo registrar el desenlace del aviso:", fallo);
    }
  }

  try {
    // 1. Obtener el payload del Webhook de Supabase
    const requestedId = webhookNotificationId(await req.json());
    if (!requestedId) return new Response('Invalid webhook', { status: 400 });
    // El payload solo identifica la fila: destinatario, evento y estado se releen del servidor.
    const { data: notificacion, error: notificationError } = await supabaseAdmin
      .from('notificaciones')
      .select('id,destinatario_id,evento,estado_aviso_correo')
      .eq('id', requestedId)
      .maybeSingle();
    if (notificationError) throw new Error('No se pudo consultar la notificación');
    if (!notificacion) return new Response('Not found', { status: 404 });
    notificacionId = notificacion.id;

    // Si no es un registro pendiente, lo ignoramos
    if (!notificacion || notificacion.estado_aviso_correo !== 'pendiente') {
      return new Response("No action required", { status: 200 });
    }

    // 2. El cliente con Service Role ya está inicializado arriba (bypasea RLS para uso interno).

    // 3. Buscar el correo del destinatario y sus preferencias (CU 15)
    const { data: cuenta, error: cuentaError } = await supabaseAdmin
      .from("cuentas")
      .select("correo, nombre_completo, avisos_correo")
      .eq("id", notificacion.destinatario_id)
      .single();

    if (cuentaError || !cuenta) throw new Error("No se encontró la cuenta");

    // 4. Respetar la preferencia del usuario: si desactivó correos, marcamos como no_aplica
    if (cuenta.avisos_correo === false) {
      await supabaseAdmin
        .from("notificaciones")
        .update({ estado_aviso_correo: "no_aplica" })
        .eq("id", notificacion.id);
      await registrarDesenlace(notificacionId, "no_aplica", "El destinatario tiene los correos desactivados");
      return new Response("El usuario tiene los correos desactivados", { status: 200 });
    }

    // 5. Preparar el contenido del correo según el evento
    let asunto = "Nueva notificación de la plataforma";
    let texto = `Hola ${cuenta.nombre_completo}, tienes una nueva notificación.`;

    switch (notificacion.evento) {
      case "nueva_solicitud":
        asunto = "Has recibido una nueva solicitud de contacto";
        texto = `Hola ${cuenta.nombre_completo},\n\nTienes una nueva solicitud de contacto esperando tu revisión. Por favor ingresa a tu perfil para aceptarla o rechazarla.`;
        break;
      case "nuevo_mensaje":
        asunto = "Tienes un nuevo mensaje";
        texto = `Hola ${cuenta.nombre_completo},\n\nHas recibido un nuevo mensaje en una de tus solicitudes activas.`;
        break;
      case "revision_resuelta":
        asunto = "Resultado de tu revisión profesional";
        texto = `Hola ${cuenta.nombre_completo},\n\nEl estado de tu verificación profesional ha sido actualizado. Ingresa para ver los detalles.\n\nSi la verificación fue aprobada, recuerda que tu perfil se ofrece en el directorio solo cuando la publicación esté activa en tu Privacidad.`;
        break;
      case "perfil_suspendido":
        asunto = "Tu perfil dejó de mostrarse en el directorio";
        texto = `Hola ${cuenta.nombre_completo},\n\nTu perfil profesional dejó de aparecer en la búsqueda pública. Ingresa a la plataforma para consultar el motivo registrado y las acciones disponibles.`;
      break;
      // NUEVO BLOQUE PARA LA CANCELACIÓN
      case "solicitud_cancelada":
        asunto = "Aviso: Una solicitud de contacto ha sido cancelada";
        texto = `Hola ${cuenta.nombre_completo},\n\nTe informamos que el ciudadano ha cancelado la solicitud de contacto que te había enviado recientemente. Ya no es necesario que tomes acción sobre ella.`;
        break;
      // Avisos genéricos: no incluyen el relato, las evidencias ni el texto de los mensajes.
      case "solicitud_aceptada":
        asunto = "Tu solicitud de contacto fue aceptada";
        texto = `Hola ${cuenta.nombre_completo},\n\nEl abogado aceptó tu solicitud de contacto. Ingresa a la plataforma para consultar la conversación habilitada.`;
        break;
      case "solicitud_rechazada":
        asunto = "Respuesta a tu solicitud de contacto";
        texto = `Hola ${cuenta.nombre_completo},\n\nTu solicitud de contacto fue rechazada. Ingresa a la plataforma para consultar el estado y, si se registró, el motivo.`;
        break;
      case "privacidad_resuelta":
        asunto = "Respuesta a tu petición de privacidad";
        texto = `Hola ${cuenta.nombre_completo},\n\nSe registró una resolución sobre tu petición de privacidad. Ingresa a la plataforma para consultarla.`;
        break;
    }

    // 6. Enviar el correo electrónico
    const info = await transporter.sendMail({
      from: `"LexPortal" <${Deno.env.get("SMTP_USER")}>`,
      to: cuenta.correo,
      subject: asunto,
      text: texto,
    });

    // 7. Marcar la notificación como enviada exitosamente
    await supabaseAdmin
      .from("notificaciones")
      .update({ estado_aviso_correo: "enviado" })
      .eq("id", notificacion.id);
    await registrarDesenlace(notificacionId, "entregado", `destinatarios aceptados: ${info.accepted?.join(", ") ?? "sin datos"}`);

    return new Response(JSON.stringify({ success: true, message: "Correo enviado" }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error al procesar el correo:", error);

    // El aviso interno se conserva: solo se registra que el correo no pudo enviarse,
    // para que la interfaz no lo muestre como pendiente de forma indefinida (CU 15).
    if (notificacionId) {
      try {
        await supabaseAdmin
          .from("notificaciones")
          .update({ estado_aviso_correo: "fallido" })
          .eq("id", notificacionId);
      } catch (falloRegistro) {
        console.error("No se pudo marcar el aviso como fallido:", falloRegistro);
      }
    }

    // El motivo queda consultable por SQL, no solo en esta terminal.
    await registrarDesenlace(notificacionId, "error", String(error));

    return new Response(JSON.stringify({ error: "No se pudo procesar el aviso" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});