export type Theme = 'dark' | 'light'
export type ViewMode = 'editor' | 'preview' | 'split'
export interface FileNode {
  path: string
  name: string
  kind: 'file' | 'directory'
  children?: FileNode[]
}
export interface DiskDocument {
  path: string
  content: string
  revision: string
}
export interface Preferences {
  theme: Theme
  mode: ViewMode
  sidebar: boolean
  autosave: boolean
  split: number
}
export interface Session {
  workspace: string | null
  paths: string[]
  activePath: string | null
  preferences: Preferences
}
export const defaultPreferences: Preferences = {
  theme: 'dark',
  mode: 'split',
  sidebar: true,
  autosave: true,
  split: 50,
}
export interface Workspace {
  path: string
  tree: FileNode[]
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: string; code?: string }
export interface StudioAPI {
  openFile(): Promise<Result<DiskDocument | null>>
  openWorkspace(): Promise<Result<Workspace | null>>
  tree(): Promise<Result<Workspace | null>>
  read(path: string): Promise<Result<DiskDocument>>
  save(document: DiskDocument): Promise<Result<DiskDocument>>
  saveAs(content: string): Promise<Result<DiskDocument | null>>
  create(parent: string, name: string, kind: 'file' | 'directory'): Promise<Result<string>>
  rename(path: string, name: string): Promise<Result<string>>
  remove(path: string): Promise<Result<boolean>>
  restore(): Promise<
    Result<{ session: Session; workspace: Workspace | null; documents: DiskDocument[] }>
  >
  session(session: Session): Promise<Result<void>>
  export(format: 'html' | 'pdf', html: string, title: string): Promise<Result<boolean>>
  external(url: string): Promise<Result<void>>
  onDiskChange(callback: () => void): () => void
  onCloseRequested(callback: () => void): () => void
  closeReady(): void
}
