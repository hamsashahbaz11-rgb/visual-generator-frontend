// API base URL - defaults to localhost:3001 for development, but can be overridden via VITE_API_BASE_URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'
export const RENDER_POLL_INTERVAL = 2000
export const ACCESS_TOKEN_KEY = 'framewell_access_token'
export const DEFAULT_SPEC = {
  version: 1,
  meta: { fps: 30, width: 1920, height: 1080, durationInSeconds: 10 },
  theme: {
    background: { type: 'color' as const, color: '#EFE9DC' },
    palette: { primary: '#F5A623', text: '#2B2620', surface: '#FFFFFF', accent: '#1F3A93' },
    fontFamily: 'Inter',
    speed: 1,
    defaultEasing: 'ease-out' as const,
  },
  scenes: [],
}
