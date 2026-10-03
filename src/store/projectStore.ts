import { create } from 'zustand'
import type { Project } from '../types/api'

interface ProjectState { currentProject: Project | null; setCurrentProject: (project: Project | null) => void; updateSpec: (spec: Record<string, unknown>) => void }
export const useProjectStore = create<ProjectState>((set) => ({ currentProject: null, setCurrentProject: (currentProject) => set({ currentProject }), updateSpec: (spec) => set((state) => ({ currentProject: state.currentProject ? { ...state.currentProject, spec } : null })) }))
