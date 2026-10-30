export interface ReleaseNotes {
  version: string
  notes: string
  publishedAt: string | null
}
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'
  | 'unavailable'
export interface UpdateState {
  currentVersion: string
  phase: UpdatePhase
  latestVersion: string | null
  releases: ReleaseNotes[]
  progress: number
  message: string | null
  installationNotice: string | null
  canInstall: boolean
  releaseURL: string
}
