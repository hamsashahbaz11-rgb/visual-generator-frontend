export type AssetKind = 'audio' | 'video' | 'image' | 'logo' | 'side_video'
export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring'
export type Anchor = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface Position { anchor: Anchor; offsetX: number; offsetY: number }
export interface Transition { style: string; duration: number; easing: Easing }
export interface Scene {
  id: string
  component: string
  at: number
  duration: number
  position: Position
  props: Record<string, unknown>
  color?: string
  enter: Transition
  exit?: Transition
  trigger?: { word: string; occurrence: number }
}

export interface VisualSpec {
  version: 1
  meta: { fps: number; width: number; height: number; durationInSeconds: number }
  theme: {
    background:
      | { type: 'color'; color: string }
      | { type: 'gradient'; from: string; to: string; angle: number }
      | { type: 'image'; assetId: string; fit: 'cover' | 'contain' }
    palette: Record<string, string>
    fontFamily: string
    speed: number
    defaultEasing: Easing
  }
  audioAssetId?: string
  sideVideo?: { assetId: string; position: Position; sizePercent: number; shape: 'circle' | 'rounded' | 'square' }
  scenes: Scene[]
}

export const isVisualSpec = (value: unknown): value is VisualSpec => {
  if (!value || typeof value !== 'object') return false
  const spec = value as Partial<VisualSpec>
  return spec.version === 1 && Array.isArray(spec.scenes) && Boolean(spec.meta) && Boolean(spec.theme)
}
