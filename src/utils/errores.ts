// Normaliza los errores de Supabase (PostgREST y Auth) sin exponer detalles internos.
// No registra contenido de relatos, evidencias ni mensajes.

type ErrorConMensaje = { message: string; code?: string }

function tieneMensaje(valor: unknown): valor is ErrorConMensaje {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'message' in valor &&
    typeof (valor as { message: unknown }).message === 'string'
  )
}

function tieneCodigo(valor: unknown, codigos: string[]): boolean {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'code' in valor &&
    typeof (valor as { code: unknown }).code === 'string' &&
    codigos.includes((valor as { code: string }).code)
  )
}

export function mensajeDeError(error: unknown, alternativo = 'No se pudo completar la operación. Inténtalo de nuevo.'): string {
  if (tieneMensaje(error)) {
    const mensaje = error.message.trim()
    if (mensaje) return mensaje
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return alternativo
}

/** RLS y privilegios: PostgREST responde 42501 o un mensaje de row-level security. */
export function esErrorDePermiso(error: unknown): boolean {
  if (tieneCodigo(error, ['42501', 'PGRST301', 'PGRST302'])) return true
  if (tieneMensaje(error)) {
    const mensaje = error.message.toLowerCase()
    return (
      mensaje.includes('row-level security') ||
      mensaje.includes('permission denied') ||
      mensaje.includes('no tiene permisos') ||
      mensaje.includes('violates row-level security')
    )
  }
  return false
}

export function esCorreoDuplicado(error: unknown): boolean {
  if (tieneCodigo(error, ['23505', 'user_already_exists'])) return true
  if (tieneMensaje(error)) {
    const mensaje = error.message.toLowerCase()
    return mensaje.includes('already registered') || mensaje.includes('ya está registrado') || mensaje.includes('duplicate')
  }
  return false
}
