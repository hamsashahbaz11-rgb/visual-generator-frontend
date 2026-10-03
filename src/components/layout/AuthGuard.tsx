import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
export function AuthGuard() { return useAuthStore((state) => state.token) ? <Outlet /> : <Navigate to="/login" replace /> }
