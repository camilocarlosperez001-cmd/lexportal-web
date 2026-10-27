import { useState } from 'react'
import { Button, Field, Flex, FileUpload, Stack, Text } from '@chakra-ui/react'
import { Paperclip, Upload } from 'lucide-react'
import { toaster } from '../../../components/ui/toaster-store'
import { formatearFechaHora } from '../../../utils/fechas'
import { mensajeDeError } from '../../../utils/errores'
import { etiquetaTipoEvidencia } from '../../../utils/etiquetas'
import { validarArchivoEvidencia } from '../../../utils/validaciones'
import { adjuntarEvidenciaProfesional, type TipoEvidenciaProfesional } from '../services/almacenamiento'
import type { EvidenciaPrivada } from '../services/perfil'

type AdjuntarEvidenciasProps = {
  versionId: string
  numeroVersion: number
  cuentaId: string
  evidencias: EvidenciaPrivada[]
  alTerminar: () => void
}

/** Los dos soportes que admite una presentación. */
const TIPOS_SOPORTE: { tipo: TipoEvidenciaProfesional; etiqueta: string }[] = [
  { tipo: 'identificacion', etiqueta: 'Identificación privada' },
  { tipo: 'tarjeta_profesional', etiqueta: 'Tarjeta profesional' },
]

/**
 * Soporte de la identificación y de la tarjeta profesional de una versión pendiente
 * (CU 02 y 12).
 *
 * Cada número tiene su propio archivo y su propio botón: «Añadir» si la versión todavía
 * no tiene un soporte de ese tipo y «Reemplazar» si ya lo tiene. Un reemplazo sube un
 * objeto nuevo y registra otra fila en `evidencias_privadas` con el tipo correspondiente;
 * la anterior no se borra: queda en el historial de la versión.
 *
 * Es necesario porque el registro con confirmación por correo crea el perfil y la versión
 * en el servidor, pero los archivos requieren la sesión del titular. Van al bucket privado
 * bajo su identificador y nunca se publican.
 */
export function AdjuntarEvidencias({
  versionId,
  numeroVersion,
  cuentaId,
  evidencias,
  alTerminar,
}: AdjuntarEvidenciasProps) {
  const [archivos, setArchivos] = useState<Partial<Record<TipoEvidenciaProfesional, File | null>>>({})
  const [errores, setErrores] = useState<Partial<Record<TipoEvidenciaProfesional, string>>>({})
  const [subiendo, setSubiendo] = useState<TipoEvidenciaProfesional | null>(null)

  /** Soporte más reciente de cada tipo; la consulta llega ordenada por fecha descendente. */
  function soporteRegistrado(tipo: TipoEvidenciaProfesional): EvidenciaPrivada | null {
    return evidencias.find((evidencia) => evidencia.tipo === tipo) ?? null
  }

  function seleccionar(tipo: TipoEvidenciaProfesional, archivo: File | null) {
    setArchivos((actual) => ({ ...actual, [tipo]: archivo }))
    setErrores((actual) => ({ ...actual, [tipo]: undefined }))
  }

  async function adjuntar(tipo: TipoEvidenciaProfesional) {
    const archivo = archivos[tipo]
    if (!archivo) {
      setErrores((actual) => ({ ...actual, [tipo]: 'Selecciona un archivo PDF, JPEG o PNG.' }))
      return
    }
    const problema = validarArchivoEvidencia(archivo)
    if (problema) {
      setErrores((actual) => ({ ...actual, [tipo]: `«${archivo.name}»: ${problema}` }))
      return
    }

    setSubiendo(tipo)
    try {
      await adjuntarEvidenciaProfesional(versionId, cuentaId, archivo, tipo)
      seleccionar(tipo, null)
      toaster.create({
        title: `${etiquetaTipoEvidencia(tipo)} adjunta`,
        description: `Quedó registrada en la versión ${numeroVersion}. La revisión administrativa podrá consultarla.`,
        type: 'success',
      })
      alTerminar()
    } catch (fallo: unknown) {
      setErrores((actual) => ({
        ...actual,
        [tipo]: mensajeDeError(fallo, 'No se pudo adjuntar el soporte. Inténtalo de nuevo.'),
      }))
    } finally {
      setSubiendo(null)
    }
  }

  return (
    <Stack gap="4" borderWidth="1px" borderColor="border" borderRadius="md" p="4" bg="bg.subtle">
      <Flex align="center" gap="2">
        <Paperclip aria-hidden size={16} />
        <Text textStyle="title-sm">Soportes privados de la versión {numeroVersion}</Text>
      </Flex>

      <Text textStyle="body-sm" color="fg.muted">
        Un archivo por número. PDF, JPEG o PNG de hasta 10 MB. Si ya existe un soporte de ese tipo, se añade uno nuevo y
        el anterior se conserva en el historial de la versión.
      </Text>

      {TIPOS_SOPORTE.map(({ tipo, etiqueta }) => {
        const registrado = soporteRegistrado(tipo)
        const archivo = archivos[tipo] ?? null
        return (
          <Field.Root key={tipo} invalid={Boolean(errores[tipo])}>
            <Field.Label>{etiqueta}</Field.Label>
            <FileUpload.Root
              accept=".pdf,.jpg,.jpeg,.png"
              maxFiles={1}
              onFileChange={(detalles) => seleccionar(tipo, detalles.acceptedFiles[0] ?? null)}
            >
              <FileUpload.HiddenInput aria-label={`Soporte de ${etiqueta} de la versión ${numeroVersion}`} />
              <FileUpload.Trigger asChild>
                <Button variant="outline" width="full" disabled={subiendo !== null}>
                  <Upload aria-hidden size={16} />
                  {archivo ? 'Cambiar archivo seleccionado' : `Seleccionar ${etiqueta.toLowerCase()}`}
                </Button>
              </FileUpload.Trigger>
              {archivo && (
                <FileUpload.ItemGroup mt="2">
                  <FileUpload.Items showSize clearable />
                </FileUpload.ItemGroup>
              )}
            </FileUpload.Root>
            <Field.HelperText>
              {registrado
                ? `Registrado el ${formatearFechaHora(registrado.aportada_en) ?? 'sin fecha'}. Al añadir otro, este se conserva en el historial.`
                : 'Sin soporte registrado para este número en esta versión.'}
            </Field.HelperText>
            <Field.ErrorText>{errores[tipo]}</Field.ErrorText>
            <Flex justify="flex-end">
              <Button
                size="sm"
                variant={registrado ? 'outline' : 'solid'}
                onClick={() => void adjuntar(tipo)}
                loading={subiendo === tipo}
                disabled={!archivo || subiendo !== null}
              >
                <Paperclip aria-hidden size={16} />
                {registrado ? 'Reemplazar' : 'Añadir'}
              </Button>
            </Flex>
          </Field.Root>
        )
      })}
    </Stack>
  )
}
