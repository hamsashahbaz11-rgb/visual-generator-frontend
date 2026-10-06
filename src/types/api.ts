export type AssetKind = 'audio' | 'video' | 'image' | 'logo' | 'side_video'
export type RenderStatus = 'queued' | 'running' | 'done' | 'failed'

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
  isPublic: boolean | string;
  createdAt: string;
  updatedAt: string;
  matchedField?: 'name' | 'description';
}
export interface Issue { path: string; code: string; message: string }
export interface ValidationResult { valid: boolean; issues: Issue[] }
export interface GenerationResponse { spec: Record<string, unknown>; issues: Issue[]; attempts: number }
export interface Render { id: string; projectId: string; status: RenderStatus; progress: number; specSnapshot: Record<string, unknown>; outputAssetId?: string | null; error?: string | null; createdAt: string; updatedAt: string }
export interface ManualPromptResponse { promptText: string }
export interface ApiErrorPayload { error?: { code?: string; message?: string; details?: unknown[] } }
