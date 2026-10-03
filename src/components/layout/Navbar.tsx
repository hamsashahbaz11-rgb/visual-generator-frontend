import { Bell, ChevronDown, CircleHelp, Moon, Sun } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'

export function Navbar({ projectName, onBack }: { projectName?: string; onBack?: () => void }) {
  const user = useAuthStore((state) => state.user); const logout = useAuthStore((state) => state.logout); const theme = useUiStore((state) => state.theme); const setTheme = useUiStore((state) => state.setTheme)
  return <header className="topbar"><button className="brand" onClick={onBack}><span className="brand-mark"><span /></span><span>framewell</span></button><div className="topbar-center">{projectName ? <><button className="crumb-button" onClick={onBack}>Projects</button><span>/</span><strong>{projectName}</strong></> : <span className="workspace-label">Your workspace <ChevronDown size={14} /></span>}</div><div className="top-actions"><button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button><button className="icon-button" aria-label="Notifications"><Bell size={18} /></button><button className="icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button><div className="avatar">{user?.name?.slice(0, 2).toUpperCase() ?? 'JD'}</div><button className="profile-button" onClick={logout}>{user?.name ?? 'Sign out'} <ChevronDown size={14} /></button></div></header>
}
