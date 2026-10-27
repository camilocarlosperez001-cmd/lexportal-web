import { PanelShell } from './PanelShell'
import { enlacesDePanel } from '../app/navigation'
import { useSesion } from '../features/auth/hooks/useSesion'

/** Marco de las cuentas autenticadas (ciudadano, abogado y administrador). */
export function AppLayout() {
  const { cuenta } = useSesion()
  return <PanelShell enlaces={enlacesDePanel(cuenta?.rol ?? 'ciudadano')} seccion="Mi cuenta" />
}
