// Formato de fechas para la interfaz en español. Las fechas se guardan en ISO 8601 (timestamptz).

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' })
const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' })
const FORMATO_FECHA_CORTA = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' })

function comoFecha(valor: string): Date | null {
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

export function formatearFechaHora(valor: string | null | undefined): string | null {
  if (!valor) return null
  const fecha = comoFecha(valor)
  return fecha ? FORMATO_FECHA_HORA.format(fecha) : null
}

export function formatearFecha(valor: string | null | undefined): string | null {
  if (!valor) return null
  const fecha = comoFecha(valor)
  return fecha ? FORMATO_FECHA.format(fecha) : null
}

export function formatearFechaCorta(valor: string | null | undefined): string | null {
  if (!valor) return null
  const fecha = comoFecha(valor)
  return fecha ? FORMATO_FECHA_CORTA.format(fecha) : null
}

/** Valor para un input type="date" (YYYY-MM-DD) a partir de una fecha ISO o de hoy. */
export function fechaParaInput(valor?: string | null): string {
  const fecha = valor ? comoFecha(valor) : new Date()
  if (!fecha) return ''
  const mes = `${fecha.getMonth() + 1}`.padStart(2, '0')
  const dia = `${fecha.getDate()}`.padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

/** Convierte el valor de un input type="date" al inicio o al final del día en ISO 8601. */
export function inputAFechaIso(valor: string, finDeDia = false): string | null {
  if (!valor) return null
  const [anio, mes, dia] = valor.split('-').map(Number)
  if (!anio || !mes || !dia) return null
  const fecha = finDeDia
    ? new Date(anio, mes - 1, dia, 23, 59, 59, 999)
    : new Date(anio, mes - 1, dia, 0, 0, 0, 0)
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString()
}

export function formatearPeriodo(desde: string, hasta: string): string {
  const inicio = formatearFechaCorta(desde)
  const fin = formatearFechaCorta(hasta)
  if (inicio && fin) return `${inicio} — ${fin}`
  return inicio ?? fin ?? ''
}

/** Primer día del mes en curso, útil como periodo inicial de consulta. */
export function inicioDeMes(): string {
  const hoy = new Date()
  return fechaParaInput(new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString())
}
