import { useEffect, useRef, useState } from 'react'
import { Box, Button, Field, Flex, Input, Stack, Text } from '@chakra-ui/react'
import { Send } from 'lucide-react'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { toaster } from '../../../components/ui/toaster-store'
import { cargarMensajes, enviarMensaje, observarMensajes, type Mensaje } from '../services/mensajes'

type ChatConversacionProps = { conversacionId: string; usuarioActualId: string }

// Reinicia el estado privado cuando cambia la conversación o la sesión.
export function ChatConversacion(props: ChatConversacionProps) {
  return <Conversacion key={`${props.conversacionId}:${props.usuarioActualId}`} {...props} />
}

function Conversacion({ conversacionId, usuarioActualId }: ChatConversacionProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [intento, setIntento] = useState(0)
  const envioEnCurso = useRef(false)
  const activo = useRef(false)

  useEffect(() => {
    activo.current = true
    return () => { activo.current = false }
  }, [])

  useEffect(() => {
    let vigente = true
    let ultimaConsulta = 0
    async function actualizar() {
      const consulta = ++ultimaConsulta
      try {
        const data = await cargarMensajes(conversacionId)
        if (vigente && consulta === ultimaConsulta) {
          setMensajes(data)
          setError(false)
        }
      } catch {
        if (vigente && consulta === ultimaConsulta) setError(true)
      } finally {
        if (vigente && consulta === ultimaConsulta) setCargando(false)
      }
    }
    const cancelar = observarMensajes(conversacionId, () => { void actualizar() }, () => {
      if (vigente) setError(true)
    })
    void actualizar()
    return () => { vigente = false; cancelar() }
  }, [conversacionId, intento])

  async function enviar() {
    const contenido = texto.trim()
    if (!contenido || envioEnCurso.current) return
    envioEnCurso.current = true
    setEnviando(true)
    try {
      await enviarMensaje(conversacionId, usuarioActualId, contenido)
      if (activo.current) {
        setTexto('')
        setIntento((valor) => valor + 1)
      }
    } catch {
      if (activo.current) toaster.create({ title: 'No se pudo enviar el mensaje. Inténtalo de nuevo.', type: 'error' })
    } finally {
      envioEnCurso.current = false
      if (activo.current) setEnviando(false)
    }
  }

  return (
    <Flex direction="column" h="500px" w="full" maxW="2xl" bg="bg.panel" borderWidth="1px" borderRadius="lg" p="4" gap="4">
      <Stack flex="1" overflowY="auto" gap="4" aria-label="Historial de mensajes">
        {cargando ? <FeedbackState kind="loading" title="Cargando conversación" /> : error ? (
          <FeedbackState kind="error" title="No se pudo actualizar la conversación"
            description="Comprueba tu conexión y tu acceso a esta conversación."
            action={<Button variant="outline" onClick={() => setIntento((valor) => valor + 1)}>Reintentar</Button>} />
        ) : mensajes.length === 0 ? <FeedbackState title="Aún no hay mensajes" /> : mensajes.map((mensaje) => (
          <Box key={mensaje.id} alignSelf={mensaje.autor_id === usuarioActualId ? 'flex-end' : 'flex-start'}
            bg={mensaje.autor_id === usuarioActualId ? 'primary' : 'bg.subtle'}
            color={mensaje.autor_id === usuarioActualId ? 'on-primary' : 'fg'}
            px="4" py="2" borderRadius="lg" maxW="85%">
            <Text whiteSpace="pre-wrap" overflowWrap="anywhere">{mensaje.contenido}</Text>
          </Box>
        ))}
      </Stack>
      <form onSubmit={(event) => { event.preventDefault(); void enviar() }}>
        <Flex gap="2" align="end">
          <Field.Root flex="1"><Field.Label>Mensaje</Field.Label>
            <Input value={texto} onChange={(event) => setTexto(event.target.value)}
              placeholder="Escribe un mensaje…" disabled={enviando || cargando || error} />
          </Field.Root>
          <Button type="submit" loading={enviando} disabled={!texto.trim() || cargando || error} aria-label="Enviar mensaje">
            <Send aria-hidden size={18} /><Box as="span" display={{ base: 'none', sm: 'inline' }}>Enviar</Box>
          </Button>
        </Flex>
      </form>
    </Flex>
  )
}
