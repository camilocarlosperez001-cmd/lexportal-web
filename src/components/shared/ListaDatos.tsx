import type { ReactNode } from 'react'
import { DataList } from '@chakra-ui/react'

export type DatoPresentacion = { etiqueta: string; valor: ReactNode }

/** Lista de pares etiqueta/valor para datos del contrato. Omite valores vacíos. */
export function ListaDatos({ items, orientacion = 'horizontal' }: { items: DatoPresentacion[]; orientacion?: 'horizontal' | 'vertical' }) {
  const visibles = items.filter((item) => item.valor !== null && item.valor !== undefined && item.valor !== '')
  if (visibles.length === 0) return null
  return (
    <DataList.Root orientation={orientacion} gap="3">
      {visibles.map((item) => (
        <DataList.Item key={item.etiqueta}>
          <DataList.ItemLabel color="fg.muted">{item.etiqueta}</DataList.ItemLabel>
          <DataList.ItemValue>{item.valor}</DataList.ItemValue>
        </DataList.Item>
      ))}
    </DataList.Root>
  )
}
