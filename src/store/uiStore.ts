import { create } from 'zustand'

type Theme = 'light' | 'dark'
interface UiState { theme: Theme; specEditorOpen: boolean; setTheme: (theme: Theme) => void; setSpecEditorOpen: (open: boolean) => void }
export const useUiStore = create<UiState>((set) => ({ theme: 'light', specEditorOpen: false, setTheme: (theme) => set({ theme }), setSpecEditorOpen: (specEditorOpen) => set({ specEditorOpen }) }))
