import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './HomePage'
import { NoEncontradaPage } from './NoEncontradaPage'
import { RequireSesion } from './guards/RequireSesion'
import { RequireAltaProfesional } from './guards/RequireAltaProfesional'
import { PublicLayout } from '../layouts/PublicLayout'
import { AppLayout } from '../layouts/AppLayout'
import { AdminLayout } from '../layouts/AdminLayout'
// CU 01, 02, 04 y 16 — identidad y acceso
import { LoginPage } from '../features/auth/pages/LoginPage'
import { RegistroPage } from '../features/auth/pages/RegistroPage'
import { RegistroCiudadanoPage } from '../features/auth/pages/RegistroCiudadanoPage'
import { RegistroAbogadoPage } from '../features/auth/pages/RegistroAbogadoPage'
import { RecuperarPasswordPage } from '../features/auth/pages/RecuperarPasswordPage'
import { ConfirmarCorreoPage } from '../features/auth/pages/ConfirmarCorreoPage'
// CU 05 a 08 — directorio y perfil público
import { DirectorioPage } from '../features/directorio/pages/DirectorioPage'
import { PerfilPublicoPage } from '../features/directorio/pages/PerfilPublicoPage'
// CU 09, 10 y 20 — solicitudes y orientación
import { MisSolicitudesPage } from '../features/solicitudes/pages/MisSolicitudesPage'
import { DetalleSolicitudPage } from '../features/solicitudes/pages/DetalleSolicitudPage'
import { SolicitudesRecibidasPage } from '../features/solicitudes/pages/SolicitudesRecibidasPage'
import { DetalleSolicitudRecibidaPage } from '../features/solicitudes/pages/DetalleSolicitudRecibidaPage'
// CU 11 y 15 — mensajería y notificaciones
import { ConversacionesPage } from '../features/mensajeria/pages/ConversacionesPage'
import { ConversacionPage } from '../features/mensajeria/pages/ConversacionPage'
import { NotificacionesPage } from '../features/notificaciones/pages/NotificacionesPage'
// CU 12 y 19 — cuenta, perfil profesional y privacidad
import { CuentaPage } from '../features/cuenta/pages/CuentaPage'
import { MiPerfilPage } from '../features/perfil/pages/MiPerfilPage'
import { PrivacidadPage } from '../features/privacidad/pages/PrivacidadPage'
// CU 03, 17, 18, 19 y 14 — administración
import { RevisionesPendientesPage } from '../features/verificacion/pages/RevisionesPendientesPage'
import { RevisionDetallePage } from '../features/verificacion/pages/RevisionDetallePage'
import { RevalidacionPage } from '../features/verificacion/pages/RevalidacionPage'
import { CatalogoAdminPage } from '../features/catalogo/pages/CatalogoAdminPage'
import { PrivacidadAdminPage } from '../features/privacidad/pages/PrivacidadAdminPage'
import { IndicadoresPage } from '../features/indicadores/pages/IndicadoresPage'

/**
 * Composición de rutas. Los marcos (público, autenticado y administrativo) aportan la
 * navegación; RequireSesion exige sesión y rol. La autorización efectiva permanece en
 * las políticas RLS y en las funciones de la base de datos.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/directorio" element={<DirectorioPage />} />
        <Route path="/directorio/:perfilId" element={<PerfilPublicoPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/registro/ciudadano" element={<RegistroCiudadanoPage />} />
        <Route path="/registro/abogado" element={<RegistroAbogadoPage />} />
        {/* Rutas incluidas en additional_redirect_urls de supabase/config.toml */}
        <Route path="/recuperar-password" element={<RecuperarPasswordPage />} />
        <Route path="/auth/callback" element={<ConfirmarCorreoPage />} />
        <Route path="*" element={<NoEncontradaPage />} />        
      </Route>

      {/* Cuenta y derechos del titular: siempre accesibles, también con el alta a medias */}
      <Route
        element={
          <RequireSesion>
            <AppLayout />
          </RequireSesion>
        }
      >
        <Route path="/cuenta" element={<CuentaPage />} />
        <Route path="/privacidad" element={<PrivacidadPage />} />
        <Route path="/notificaciones" element={<NotificacionesPage />} />
        <Route
          path="/mi-perfil"
          element={
            <RequireSesion roles={['abogado']}>
              <MiPerfilPage />
            </RequireSesion>
          }
        />
        {/*
          Destino del guardia RequireAltaProfesional. Reutiliza la página del perfil, que ya
          contiene el alta cuando no hay perfil y el adjuntado de evidencias cuando la
          presentación sigue pendiente. No puede estar tras el guardia: sería un bucle.
        */}
        <Route
          path="/completar-perfil"
          element={
            <RequireSesion roles={['abogado']}>
              <MiPerfilPage />
            </RequireSesion>
          }
        />
      </Route>

      {/* Uso de la plataforma: exige el alta profesional completa (sólo cuentas profesionales) */}
      <Route
        element={
          <RequireSesion>
            <RequireAltaProfesional>
              <AppLayout />
            </RequireAltaProfesional>
          </RequireSesion>
        }
      >
        <Route path="/solicitudes" element={<MisSolicitudesPage />} />
        <Route path="/solicitudes/:solicitudId" element={<DetalleSolicitudPage />} />
        <Route path="/mensajes" element={<ConversacionesPage />} />
        <Route path="/mensajes/:conversacionId" element={<ConversacionPage />} />
        <Route
          path="/solicitudes-recibidas"
          element={
            <RequireSesion roles={['abogado']}>
              <SolicitudesRecibidasPage />
            </RequireSesion>
          }
        />
        <Route
          path="/solicitudes-recibidas/:solicitudId"
          element={
            <RequireSesion roles={['abogado']}>
              <DetalleSolicitudRecibidaPage />
            </RequireSesion>
          }
        />
      </Route>

      <Route
        element={
          <RequireSesion roles={['administrador']}>
            <AdminLayout />
          </RequireSesion>
        }
      >
        <Route path="/admin" element={<Navigate to="/admin/verificacion" replace />} />
        <Route path="/admin/verificacion" element={<RevisionesPendientesPage />} />
        <Route path="/admin/verificacion/:versionId" element={<RevisionDetallePage />} />
        <Route path="/admin/revalidacion" element={<RevalidacionPage />} />
        <Route path="/admin/catalogo" element={<CatalogoAdminPage />} />
        <Route path="/admin/privacidad" element={<PrivacidadAdminPage />} />
        <Route path="/admin/indicadores" element={<IndicadoresPage />} />
      </Route>
    </Routes>
  )
}
