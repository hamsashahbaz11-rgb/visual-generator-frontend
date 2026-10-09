export type AssetKind = 'audio' | 'video' | 'image' | 'logo' | 'side_video'
export type RenderStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
export type RenderSource = 'scene-document' | 'video-spec'

export interface User { id: string; name: string; email: string }
export interface AuthTokenResponse { user: User; token: string }
export interface Project { id: string; name: string; spec: Record<string, unknown>; maxComponents: number | null; userId?: string | null; createdAt: string; updatedAt: string }
export interface ProjectSummary { id: string; name: string; createdAt: string; updatedAt: string }
export interface Asset { id: string; kind: AssetKind; originalName: string; storageKey: string; mimeType: string; sizeBytes: number; durationSeconds?: number | null; createdAt: string }
export interface TranscriptWord { word: string; start: number; end: number }
export interface Transcript { id: string; assetId: string; language?: string | null; text: string; words: TranscriptWord[]; durationSeconds?: number | null; createdAt: string }
export interface ShareUrl { url: string; expiresAt: string }
export interface Component {
  id: string;
  name: string;
  displayName: string;
  description: string;
  propsSchema: Record<string, unknown>;
  defaultProps: Record<string, unknown>;
  enterStyles: string[];
  exitStyles: string[];
  colorProps: string[];
  refProps: string[];
  assetProps: string[];
  userId?: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  matchedField?: 'name' | 'description';
}
export interface Issue { path: string; code: string; message: string }
export interface ValidationResult { valid: boolean; issues: Issue[] }
export interface GenerationResponse { spec: Record<string, unknown>; issues: Issue[]; attempts: number }
export interface Render { id: string; projectId: string; sceneId?: string | null; clientKey?: string | null; status: RenderStatus; progress: number; specSnapshot: Record<string, unknown>; outputAssetId?: string | null; error?: string | null; createdAt: string; startedAt?: string | null; completedAt?: string | null; updatedAt: string }
export interface RenderStatusPayload { id: string; projectId: string; sceneId: string | null; status: RenderStatus; progress: number; outputAssetId: string | null; error: string | null; source: RenderSource; startedAt: string | null; completedAt: string | null; createdAt: string; updatedAt: string }
export const isTerminalRenderStatus = (status: RenderStatus): boolean => status === 'done' || status === 'failed' || status === 'cancelled'
export interface ManualPromptResponse { promptText: string }
export interface ApiErrorPayload { error?: { code?: string; message?: string; details?: unknown[] } }

export interface InstancePosition { x: number; y: number }
export interface InstanceSize { width: number; height: number }
export interface InstanceTransform { rotation: number; scaleX: number; scaleY: number }
export interface InstanceStyle { opacity: number; [key: string]: unknown }
export interface InstanceTiming { start: number; duration: number; startFrame?: number; durationFrames?: number }
export type TimelineEasingName =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInBack'
  | 'easeOutBack';
export type AnimatableProperty =
  | 'position.x'
  | 'position.y'
  | 'size.width'
  | 'size.height'
  | 'transform.rotation'
  | 'transform.scaleX'
  | 'transform.scaleY'
  | 'style.opacity'
export interface TimelineKeyframe { frame: number; value: number; easing?: TimelineEasingName }
export interface AnimationTrack { property: AnimatableProperty; keyframes: TimelineKeyframe[] }
export interface InstanceAnimation { enter: string[]; exit: string[]; keyframes: unknown[]; tracks?: AnimationTrack[] }
export interface SceneTimeline { fps: number; durationFrames: number }

export interface ComponentInstance {
  id: string
  sceneId: string
  componentDefinitionId: string
  groupId?: string | null
  props: Record<string, unknown>
  position: InstancePosition
  size: InstanceSize
  transform: InstanceTransform
  style: InstanceStyle
  visible: boolean
  zIndex: number
  timing: InstanceTiming
  animation: InstanceAnimation
  createdAt?: string
  updatedAt?: string
}

export interface DocumentGroup {
  id: string
  sceneId: string
  parentGroupId?: string | null
  name: string
  zIndex: number
  createdAt?: string
  updatedAt?: string
}

export interface SceneDocument {
  id: string
  projectId: string
  name: string
  description?: string | null
  duration?: number | null
  meta?: Record<string, unknown> | null
  timeline?: SceneTimeline | null
  components: ComponentInstance[]
  groups: DocumentGroup[]
}

export interface SceneSummary {
  id: string
  projectId: string
  name: string
  description?: string | null
  duration?: number | null
  meta?: Record<string, unknown> | null
}

export type CreateInstanceInput = Partial<Omit<ComponentInstance, 'id' | 'sceneId'>> & {
  componentDefinitionId: string
  props?: Record<string, unknown>
}
export type CreateGroupInput = { name: string; parentGroupId?: string | null; zIndex?: number }

// Stage 4A: AI plan contract. Temporary structured intent applied through
// the existing domain mutations — never a second document model.
export type AISceneOperation = { type: string; [key: string]: unknown }
export interface AIScenePlan { operations: AISceneOperation[] }
export interface AIPlanUsage { promptTokens?: number; completionTokens?: number; totalTokens?: number }
export interface AIPlanMeta {
  requestId?: string
  sceneId?: string
  provider?: string
  model?: string
  contextVersion?: string
  latencyMs?: number
  usage?: AIPlanUsage
}
export interface AIPlanResponse { plan: AIScenePlan; meta: AIPlanMeta }
export interface AppliedOperation { index: number; type: string; id?: string | null }
export interface AIApplyResponse { applied: AppliedOperation[]; document: SceneDocument; meta?: AIPlanMeta }

// Stage 4B: bounded agent execution. The server owns every budget and the
// termination decision; `status` reports how the bounded loop ended, and
// `document` is always the current snapshot (earlier iterations may have
// applied even when status !== 'completed').
export type AIExecuteStatus =
  | 'completed'
  | 'max_iterations'
  | 'validation_failed'
  | 'tool_error'
  | 'provider_error'
  | 'application_error'
  | 'unauthorized'
  | 'timeout'
export interface AIAgentVerificationResult { passed: boolean; issues: string[] }
export interface AIAgentAppliedOperation {
  iteration: number
  index: number
  type: string
  id?: string | null
}
export interface AIExecuteResponse {
  status: AIExecuteStatus
  iterations: number
  toolCalls: number
  modelCalls: number
  plans: AIScenePlan[]
  appliedOperations: AIAgentAppliedOperation[]
  verification: AIAgentVerificationResult | null
  failure?: { code: string; message: string }
  document: SceneDocument
  meta: AIPlanMeta
}
