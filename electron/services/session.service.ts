import { normalizeDocumentAppearance } from '../../shared/document-themes'
import { promises as fs } from 'node:fs'
import type { Session } from '../../shared/types'
import { defaultPreferences } from '../../shared/types'
export function parseSession(raw: unknown): Session {
  const value = raw && typeof raw === 'object' ? (raw as Partial<Session>) : {}
  const p = value.preferences ?? defaultPreferences
  return {
    workspace: typeof value.workspace === 'string' ? value.workspace : null,
    paths: Array.isArray(value.paths)
      ? value.paths.filter((path): path is string => typeof path === 'string').slice(0, 100)
      : [],
    activePath: typeof value.activePath === 'string' ? value.activePath : null,
    preferences: {
      ...normalizeDocumentAppearance(p),
      theme: p.theme === 'light' ? 'light' : 'dark',
      mode: ['editor', 'preview', 'split'].includes(p.mode) ? p.mode : 'split',
      sidebar: p.sidebar !== false,
      autosave: p.autosave !== false,
      split:
        typeof p.split === 'number' && Number.isFinite(p.split)
          ? Math.max(25, Math.min(75, p.split))
          : 50,
    },
  }
}
export async function loadSession(path: string): Promise<Session> {
  try {
    return parseSession(JSON.parse(await fs.readFile(path, 'utf8')))
  } catch {
    return parseSession(null)
  }
}
export async function writeSession(path: string, session: Session): Promise<void> {
  await fs.writeFile(`${path}.tmp`, JSON.stringify(session, null, 2))
  await fs.rename(`${path}.tmp`, path)
}
