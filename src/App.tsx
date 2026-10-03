import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGuard } from './components/layout/AuthGuard'
import { DashboardPage } from './pages/DashboardPage'
import { EditorPage } from './pages/EditorPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'

export function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<AuthGuard />}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/projects/:id" element={<EditorPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
