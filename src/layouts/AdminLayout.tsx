import { PanelShell } from './PanelShell'
import { ENLACES_ADMIN_PANEL } from '../app/navigation'

/** Marco administrativo: reutiliza los módulos de dominio bajo rutas autorizadas. */
export function AdminLayout() {
  return <PanelShell enlaces={ENLACES_ADMIN_PANEL} seccion="Administración" />
}
