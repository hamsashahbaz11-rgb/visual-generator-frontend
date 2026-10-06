import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGuard } from './components/layout/AuthGuard'
import { DashboardPage } from './pages/DashboardPage'
import { EditorPage } from './pages/EditorPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ComponentsPage } from './pages/components/ComponentsPage'
import { ComponentFormPage } from './pages/components/ComponentFormPage'
import { ComponentDetailPage } from './pages/components/ComponentDetailPage'

export function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<AuthGuard />}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/projects/:id" element={<EditorPage />} />
      <Route path="/components" element={<ComponentsPage />} />
      <Route path="/components/new" element={<ComponentFormPage />} />
      <Route path="/components/:id" element={<ComponentDetailPage />} />
      <Route path="/components/:id/edit" element={<ComponentFormPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
