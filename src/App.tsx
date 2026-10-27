import { AppRoutes } from './app/routes'
import { LimiteDeErrores } from './components/shared/LimiteDeErrores'
import { SesionProvider } from './features/auth/components/SesionProvider'

export default function App() {
  return (
    <SesionProvider>
      <LimiteDeErrores>
        <AppRoutes />
      </LimiteDeErrores>
    </SesionProvider>
  )
}
