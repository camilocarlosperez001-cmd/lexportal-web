import { supabase } from '../../../lib/supabase'
import type { Tables } from '../../../types/supabase'

export type Mensaje = Pick<Tables<'mensajes_texto'>, 'id' | 'conversacion_id' | 'autor_id' | 'contenido' | 'enviado_en'>

export async function cargarMensajes(conversacionId: string) {
  const { data, error } = await supabase.from('mensajes_texto')
    .select('id, conversacion_id, autor_id, contenido, enviado_en')
    .eq('conversacion_id', conversacionId).order('enviado_en', { ascending: true })
  if (error) throw error
  return data
}

export async function enviarMensaje(conversacionId: string, autorId: string, contenido: string) {
  const { error } = await supabase.from('mensajes_texto').insert({
    conversacion_id: conversacionId, autor_id: autorId, contenido,
  })
  if (error) throw error
}

export function observarMensajes(conversacionId: string, onChange: () => void, onError: () => void) {
  const channel = supabase.channel(`chat_${conversacionId}_${crypto.randomUUID()}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'mensajes_texto',
      filter: `conversacion_id=eq.${conversacionId}`,
    }, onChange)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onChange()
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError()
    })
  return () => { void supabase.removeChannel(channel) }
}
