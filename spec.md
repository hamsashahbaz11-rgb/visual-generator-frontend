# Visual Diagram Generator — Frontend Specification

## Overview

Single-user React + TypeScript application for creating AI-powered animated explainer videos. Users upload media → transcribe → generate visual specs via AI → validate → render → download.

**Tech Stack:**
- React 18 + TypeScript
- Remotion (video composition & preview)
- Tailwind CSS (with custom color system)
- TanStack Query (data fetching & caching)
- Zustand (global state: auth, current project)
- Axios (API client with JWT interceptor)
- zod (spec validation)
- shadcn/ui (base components)

---

## Color System & Theme

### Light Theme (default)
```
Background:        #FFFFFF (pure white)
Primary text:      #111111 (almost black)
Secondary text:    #6B7280 (gray)
Borders:           #E5E7EB (light gray)
Primary accent:    #2563EB (electric blue)
Accent light:      #EFF6FF (light blue)
Secondary accent:  #06B6D4 (cyan)
```

### Dark Theme
```
Background:        #1A1A1A (dark gray)
Primary text:      #F5F5F5 (off-white)
Secondary text:    #A0A0A0 (medium gray)
Borders:           #333333 (dark borders)
Primary accent:    #3B82F6 (slightly lighter blue)
Accent light:      #1E3A5F (dark blue)
Secondary accent:  #0891B2 (darker cyan)
```

**Theme Toggle:** Detect system preference on first load, allow manual toggle in settings/navbar. Store preference in localStorage.

---

## Project Structure

```
src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── AuthGuard.tsx
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   └── MainLayout.tsx
│   ├── projects/
│   │   ├── ProjectList.tsx
│   │   ├── ProjectCard.tsx
│   │   └── NewProjectDialog.tsx
│   ├── editor/
│   │   ├── SpecEditor.tsx (JSON text area modal)
│   │   ├── SpecValidator.tsx (shows validation errors)
│   │   └── ComponentBudget.tsx
│   ├── assets/
│   │   ├── AssetUploader.tsx
│   │   ├── AssetList.tsx
│   │   └── TranscribeButton.tsx
│   ├── generation/
│   │   ├── AIGenerateForm.tsx
│   │   ├── ManualPromptDialog.tsx
│   │   └── ManualSpecSubmit.tsx
│   ├── render/
│   │   ├── RenderButton.tsx
│   │   ├── RenderJobsList.tsx
│   │   ├── RenderProgress.tsx
│   │   └── VideoDownload.tsx
│   └── common/
│       ├── LoadingSpinner.tsx
│       ├── ErrorAlert.tsx
│       └── ConfirmDialog.tsx
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── DashboardPage.tsx (project list)
│   ├── EditorPage.tsx (main workspace)
│   └── NotFoundPage.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useProject.ts
│   ├── useAssets.ts
│   ├── useTranscription.ts
│   ├── useGeneration.ts
│   ├── useRender.ts
│   └── useTheme.ts
├── services/
│   ├── api.ts (Axios instance with interceptor)
│   ├── auth.ts (register, login, logout)
│   ├── projects.ts (CRUD projects)
│   ├── assets.ts (upload, list, delete)
│   ├── transcripts.ts (transcribe, get)
│   ├── generation.ts (AI generate, manual workflows)
│   └── render.ts (create, poll, download)
├── store/
│   ├── authStore.ts (user, token)
│   ├── projectStore.ts (current project, spec)
│   └── uiStore.ts (modals, notifications)
├── types/
│   ├── api.ts (User, Project, Asset, Transcript, Render, etc.)
│   ├── spec.ts (visual spec schema)
│   └── errors.ts
├── utils/
│   ├── validation.ts (zod schemas)
│   ├── constants.ts (API base URL, config)
│   └── formatters.ts (dates, file sizes, etc.)
├── styles/
│   ├── globals.css (Tailwind + CSS variables)
│   └── theme.css (theme tokens)
└── App.tsx

public/
├── index.html
└── ai-prompt-rules.html (guide for manual AI spec writing)
```

---

## Key Pages & Workflows

### 1. **Authentication Pages**

#### Login (`LoginPage.tsx`)
- Email + password form
- Link to register
- Error display
- Redirect to dashboard on success
- Store JWT in localStorage & Zustand

#### Register (`RegisterPage.tsx`)
- Name + email + password (min 12 chars validation)
- Submit creates user + stores token
- Auto-redirect to dashboard

---

### 2. **Dashboard Page (`DashboardPage.tsx`)**

**Layout:**
- Navbar (logo, theme toggle, user menu with logout)
- Main area: project grid/list
- New Project button (opens dialog)

**New Project Dialog:**
- Input: project name
- Optional: upload/paste initial spec
- Create button
- Redirect to EditorPage on success

**Project Card:**
- Project name
- Created/updated dates
- Quick actions: Open, Delete
- Click → EditorPage

---

### 3. **Editor Page (`EditorPage.tsx`)** — Main Workspace

**Layout: 3-column**

#### Left Sidebar (Assets Panel)
- **Upload Section**
  - Drag-drop or click to upload (audio, video, image, logo, side_video)
  - Show file kind selector
  - Progress bar for large files
  
- **Asset List**
  - Thumbnail (if image) or file icon
  - Name, size, duration (if video/audio)
  - Delete button
  - Transcribe button (if audio/video)
    - Shows transcription progress
    - Once done, list transcript words with timestamps

#### Center Area (Main Editor)
- **Tabs:**
  1. **Project Overview**
     - Project name (editable)
     - Current spec status
     - Component budget display (if set)
  
  2. **Visual Preview** (Remotion)
     - Render spec as video in preview player
     - Play/pause, scrubber, zoom
     - Show component bounds + labels (debug mode toggle)
     - Falls back to "Spec not yet generated" if spec is empty
  
  3. **Generation Workflow**
     - **Auto Generate**
       - Dropdown: select transcript (if transcripts exist)
       - Optional: custom instructions textarea
       - Dropdown: AI provider (configured backend or manual)
       - If "manual," button opens ManualPromptDialog
       - Generate button → calls POST /projects/{id}/generate
       - Shows AI generation progress
     
     - **Manual Workflow**
       - Link: "Use external AI"
       - Button: "Get prompt for external AI" → ManualPromptDialog (copy prompt)
       - After using external AI, "Submit JSON" → dialog with textarea
       - Paste JSON → validate → submit

#### Right Sidebar (Spec & Render Panel)
- **Spec Actions**
  - Button: "Edit Spec" → SpecEditor modal (see below)
  - Button: "Validate Spec" → calls POST /projects/{id}/validate
  - Shows validation results (errors in red, warnings in yellow)

- **Render Section**
  - Button: "Create Render Job" → calls POST /projects/{id}/renders
  - Shows queued/recent renders:
    - Status badge (queued, running, done, failed)
    - Progress bar (if running)
    - Error message (if failed)
    - Download link (if done)
  - Poll render status every 2s

---

### 4. **Spec Editor Modal (`SpecEditor.tsx`)**

- Large modal covering most of screen
- Textarea: full-width, monospace font
- Buttons:
  - **Copy to clipboard** (for external AI use)
  - **Format JSON** (prettify)
  - **Save** (closes modal, updates project via PUT /projects/{id})
  - **Cancel**
- Show line numbers
- Basic syntax highlighting (optional: use `react-syntax-highlighter`)
- Show spec size

---

## API Integration Layer

### `services/api.ts`
```typescript
// Axios instance with JWT interceptor
export const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
});

// Request interceptor: add Bearer token
apiClient.interceptors.request.use((config) => {
  const token = authStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 → redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authStore.getState().logout();
      // Redirect to login
    }
    return Promise.reject(error);
  }
);
```

### Service Modules (examples)

**`services/projects.ts`**
```typescript
export const projectsAPI = {
  list: () => apiClient.get('/projects'),
  create: (name: string, spec?: object) => 
    apiClient.post('/projects', { name, spec }),
  get: (id: string) => apiClient.get(`/projects/${id}`),
  update: (id: string, data: Partial<Project>) => 
    apiClient.put(`/projects/${id}`, data),
  delete: (id: string) => apiClient.delete(`/projects/${id}`),
  validate: (id: string, spec: object) => 
    apiClient.post(`/projects/${id}/validate`, { spec }),
};
```

**`services/render.ts`**
```typescript
export const renderAPI = {
  create: (projectId: string) => 
    apiClient.post(`/projects/${projectId}/renders`),
  list: (projectId: string) => 
    apiClient.get(`/projects/${projectId}/renders`),
  get: (renderId: string) => 
    apiClient.get(`/renders/${renderId}`),
  download: (renderId: string) => 
    apiClient.get(`/renders/${renderId}/file`, { responseType: 'blob' }),
};
```

---

## State Management (Zustand)

### `store/authStore.ts`
```typescript
interface AuthStore {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}
```

### `store/projectStore.ts`
```typescript
interface ProjectStore {
  currentProject: Project | null;
  setCurrentProject: (project: Project) => void;
  updateSpec: (spec: object) => void;
}
```

### `store/uiStore.ts`
```typescript
interface UIStore {
  specEditorOpen: boolean;
  setSpecEditorOpen: (open: boolean) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  notifications: Notification[];
  addNotification: (msg: string, type: 'info' | 'error' | 'success') => void;
}
```

---

## Remotion Integration

### Video Composition

**File: `src/remotion/Composition.tsx`**
```typescript
import { Composition } from 'remotion';

export const MyComposition = ({ spec }: { spec: VisualSpec }) => {
  // Render components from spec
  // spec.components[].type → map to Remotion component
  // spec.components[].props → pass as props
  // spec.components[].enterStyles → use in <AbsoluteFill> with transitions
  // spec.components[].timeline → keyframe animations using <Sequence>
  return (
    <AbsoluteFill>
      {spec.components.map((comp) => (
        <RemotionComponent key={comp.id} {...comp} />
      ))}
    </AbsoluteFill>
  );
};

// In EditorPage preview:
<Player
  component={MyComposition}
  durationInFrames={fps * duration}
  fps={30}
  compositionWidth={1920}
  compositionHeight={1080}
  style={{ width: '100%', height: 'auto' }}
/>
```

### Component Mapping

Create a registry of Remotion components matching the backend component definitions:

**File: `src/remotion/components/index.ts`**
```typescript
export const componentRegistry = {
  'text-box': TextBox,
  'animated-counter': AnimatedCounter,
  'logo': Logo,
  'arrow': Arrow,
  'highlight-box': HighlightBox,
  // ... map to actual Remotion components
};

export const RemotionComponent = ({ type, props, enterStyles, exitStyles }: any) => {
  const Component = componentRegistry[type];
  if (!Component) return null;
  return <Component {...props} />;
};
```

---

## Key Hooks

### `useProject`
```typescript
export const useProject = (projectId: string) => {
  const query = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsAPI.get(projectId),
  });
  
  const updateMutation = useMutation({
    mutationFn: (data: Partial<Project>) => 
      projectsAPI.update(projectId, data),
    onSuccess: () => queryClient.invalidateQueries(['project', projectId]),
  });
  
  return { ...query, update: updateMutation.mutate };
};
```

### `useRender`
```typescript
export const useRender = (projectId: string) => {
  const { data: renders, refetch } = useQuery({
    queryKey: ['renders', projectId],
    queryFn: () => renderAPI.list(projectId),
    refetchInterval: 2000, // poll every 2s
  });
  
  const createMutation = useMutation({
    mutationFn: () => renderAPI.create(projectId),
    onSuccess: () => refetch(),
  });
  
  return { renders, createRender: createMutation.mutate };
};
```

---

## Validation & Error Handling

### `utils/validation.ts`
```typescript
import { z } from 'zod';

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  spec: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const specSchema = z.object({
  components: z.array(z.object({
    id: z.string(),
    type: z.string(),
    props: z.record(z.any()),
    timeline: z.object({ start: z.number(), end: z.number() }).optional(),
  })),
});
```

### Error Display
```typescript
export const ErrorAlert = ({ error }: { error: AxiosError }) => {
  const message = error.response?.data?.error?.message || 
                  error.message || 
                  'Something went wrong';
  return <div className="bg-red-100 text-red-700 p-4 rounded">{message}</div>;
};
```

---

## Features & User Flows

### Flow 1: Create & Generate Spec
1. User logs in → dashboard
2. Click "New Project" → name → create
3. Redirect to editor
4. Upload audio/video
5. Transcribe (waits for backend)
6. Select transcript + optional instructions
7. Click "Generate" → backend AI generates spec
8. Spec appears in preview
9. If validation errors, show them
10. Edit spec manually if needed (SpecEditor modal)

### Flow 2: Manual AI Workflow
1. Same setup as Flow 1, but click "Use External AI"
2. SpecEditor opens with prompt template (read-only)
3. Copy prompt button → user takes to ChatGPT/Claude
4. User pastes AI-generated JSON back
5. "Submit JSON" button → validate + apply spec

### Flow 3: Render & Download
1. Spec is ready (generated or manually edited)
2. Click "Create Render Job"
3. Render card appears: status = "queued"
4. Frontend polls every 2s
5. Status changes: "running" (show progress bar)
6. Status changes: "done"
7. Download button appears
8. User clicks → downloads MP4

### Flow 4: Multi-Tab Workflow
- User can open EditorPage in multiple tabs (same project or different projects)
- Each tab polls renders independently
- State syncs via API calls (no cross-tab broadcast needed)
- JWT from localStorage works across tabs

---

## Configuration & Env Variables

**`.env.local`**
```
REACT_APP_API_URL=http://localhost:3001
REACT_APP_REMOTION_FPS=30
REACT_APP_DEFAULT_VIDEO_WIDTH=1920
REACT_APP_DEFAULT_VIDEO_HEIGHT=1080
```

---

## Styling Approach

### Tailwind + CSS Variables

**`styles/globals.css`**
```css
:root[data-theme="light"] {
  --color-bg: #FFFFFF;
  --color-text: #111111;
  --color-text-secondary: #6B7280;
  --color-border: #E5E7EB;
  --color-primary: #2563EB;
  --color-primary-light: #EFF6FF;
  --color-secondary: #06B6D4;
}

:root[data-theme="dark"] {
  --color-bg: #1A1A1A;
  --color-text: #F5F5F5;
  --color-text-secondary: #A0A0A0;
  --color-border: #333333;
  --color-primary: #3B82F6;
  --color-primary-light: #1E3A5F;
  --color-secondary: #0891B2;
}

@apply text-[color:var(--color-text)] bg-[color:var(--color-bg)];
```

**Tailwind config:**
```js
module.exports = {
  theme: {
    colors: {
      bg: 'var(--color-bg)',
      text: 'var(--color-text)',
      'text-secondary': 'var(--color-text-secondary)',
      border: 'var(--color-border)',
      primary: 'var(--color-primary)',
      'primary-light': 'var(--color-primary-light)',
      secondary: 'var(--color-secondary)',
    },
  },
};
```

---

## Dependencies (package.json)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.3.3",
    "remotion": "^4.x",
    "axios": "^1.6.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.4.0",
    "tailwindcss": "^3.3.0",
    "shadcn/ui": "latest",
    "zod": "^3.22.0",
    "react-router-dom": "^6.18.0",
    "react-syntax-highlighter": "^15.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0"
  }
}
```

---

## Implementation Priority

1. **Phase 1:** Auth + Dashboard + Project CRUD
2. **Phase 2:** Asset upload + transcription
3. **Phase 3:** AI generation (auto + manual workflows)
4. **Phase 4:** Spec editor + validation
5. **Phase 5:** Remotion preview integration
6. **Phase 6:** Render polling + download
7. **Phase 7:** Theme toggle + polish

---

## Next Steps

1. **Confirm Remotion component mapping** — how do backend components map to Remotion players?
2. **Define spec JSON schema** — share exact structure for `spec.components[]` so frontend knows what to render
3. **MCP or Prompt?** — for manual AI workflow, do you want a long prompt in the dialog, or an HTML file users can share with external AI?

This spec is ready to hand off to a frontend team. No need for OpenAPI—the API service layer abstracts it.