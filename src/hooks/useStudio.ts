import { useEffect, useRef, useState } from 'react'
import { defaultPreferences, type DiskDocument, type Preferences, type Result, type Workspace } from '../../shared/types'
import { type Tab, isDirty } from '../components/Tabs'
import type { Ask } from './useDialog'

export class OperationError extends Error { constructor(message: string, public code?: string) { super(message) } }
export function unwrap<T>(result: Result<T>): T { if (!result.ok) throw new OperationError(result.error, result.code); return result.value }
const nameOf = (path: string) => path.split(/[\\/]/).pop() ?? 'Sans titre.md'
const fromDisk = (doc: DiskDocument): Tab => ({ ...doc, id: crypto.randomUUID(), name: nameOf(doc.path), savedContent: doc.content, state: 'saved' })
const under = (path: string, parent: string) => path === parent || path.startsWith(`${parent}/`) || path.startsWith(`${parent}\\`)
export function useStudio(ask: Ask) {
  const [tabs, setTabs] = useState<Tab[]>([])
  const tabsRef = useRef<Tab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeRef = useRef<string | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const workspaceRef = useRef<Workspace | null>(null)
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(new Map<string, Promise<boolean>>())
  const operation = useRef(false)
  const mutate = (fn: (tabs: Tab[]) => Tab[]) => { const next = fn(tabsRef.current); tabsRef.current = next; setTabs(next) }
  const activate = (id: string | null) => { activeRef.current = id; setActiveId(id) }
  const setFolder = (folder: Workspace | null) => { workspaceRef.current = folder; setWorkspace(folder) }
  const report = (error: unknown) => setError(error instanceof Error ? error.message : String(error))
  const guard = async (work: () => Promise<void>) => {
    if (operation.current) return
    operation.current = true; setBusy(true)
    try { await work() } catch (error) { report(error) } finally { operation.current = false; setBusy(false) }
  }
  const addDocument = (doc: DiskDocument) => {
    const existing = tabsRef.current.find(tab => tab.path === doc.path)
    if (existing) { activate(existing.id); return }
    const tab = fromDisk(doc)
    mutate(tabs => [...tabs, tab]); activate(tab.id)
  }
  const refresh = async () => { setFolder(unwrap(await window.studio.tree())) }
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        if (!window.studio) throw new Error('Lancez Markdown Studio avec « npm run dev » dans Electron.')
        const result = unwrap(await window.studio.restore())
        if (!alive) return
        const restored = result.documents.map(fromDisk)
        mutate(() => restored); setFolder(result.workspace); setPreferences(result.session.preferences)
        activate(restored.find(tab => tab.path === result.session.activePath)?.id ?? restored[0]?.id ?? null)
      } catch (error) { if (alive) report(error) }
      finally { if (alive) setReady(true) }
    })()
    return () => { alive = false }
  }, [])
  const sessionSnapshot = () => ({ workspace: workspaceRef.current?.path ?? null, paths: tabsRef.current.flatMap(tab => tab.path ? [tab.path] : []), activePath: tabsRef.current.find(tab => tab.id === activeRef.current)?.path ?? null, preferences })
  useEffect(() => {
    if (!ready || !window.studio) return
    const timer = setTimeout(() => { void window.studio.session(sessionSnapshot()).then(result => { if (!result.ok) report(new Error(result.error)) }) }, 300)
    return () => clearTimeout(timer)
  }, [tabs.map(tab => tab.path).join('\0'), activeId, workspace?.path, preferences, ready])
  const save = async (id: string, copy = false): Promise<boolean> => {
    const pending = inFlight.current.get(id)
    if (pending) { await pending; const latest = tabsRef.current.find(tab => tab.id === id); return latest && isDirty(latest) ? save(id, copy) : true }
    const tab = tabsRef.current.find(tab => tab.id === id)
    if (!tab || (!copy && !isDirty(tab) && tab.path)) return true
    if (!copy && tab.state === 'conflict') { report(new Error('Résolvez le conflit : rechargez le fichier ou enregistrez une copie.')); return false }
    const job = (async () => {
      mutate(tabs => tabs.map(t => t.id === id ? { ...t, state: 'saving', error: undefined } : t))
      try {
        const saved = unwrap(await (copy || !tab.path ? window.studio.saveAs(tab.content) : window.studio.save({ path: tab.path, content: tab.content, revision: tab.revision })))
        if (!saved) { mutate(tabs => tabs.map(t => t.id === id ? { ...t, state: isDirty(t) ? 'dirty' : 'saved' } : t)); return false }
        // A Save As target might already have its own tab. Never replace that tab's unsaved buffer.
        const other = tabsRef.current.find(t => t.id !== id && t.path === saved.path)
        if (other) {
          mutate(tabs => tabs.map(t => t.id === other.id ? { ...t, state: 'conflict', error: 'Ce fichier vient d’être enregistré depuis un autre onglet.' } : t))
        }
        mutate(tabs => tabs.map(t => t.id === id ? { ...t, path: saved.path, name: nameOf(saved.path), revision: saved.revision, savedContent: saved.content, state: t.content === saved.content ? 'saved' : 'dirty' } : t))
        if (workspaceRef.current) await refresh().catch(report)
        return true
      } catch (error) {
        const conflict = error instanceof OperationError && error.code === 'CONFLICT'
        mutate(tabs => tabs.map(t => t.id === id ? { ...t, state: conflict ? 'conflict' : 'error', error: error instanceof Error ? error.message : String(error) } : t))
        report(error); return false
      }
    })()
    inFlight.current.set(id, job)
    try { return await job } finally { inFlight.current.delete(id) }
  }
  const approveClose = async (id: string): Promise<boolean> => {
    await inFlight.current.get(id)
    const tab = tabsRef.current.find(tab => tab.id === id)
    if (!tab || !isDirty(tab)) return true
    const choice = await ask({ title: 'Enregistrer les modifications ?', message: `« ${tab.name} » contient des modifications non enregistrées.`, choices: [{ label: 'Ne pas enregistrer', value: 'discard', danger: true }, { label: 'Enregistrer', value: 'save', primary: true }] })
    return choice === 'discard' || (choice === 'save' && await save(id))
  }
  const close = (id: string) => guard(async () => {
    if (!await approveClose(id)) return
    const index = tabsRef.current.findIndex(tab => tab.id === id)
    mutate(tabs => tabs.filter(tab => tab.id !== id))
    if (activeRef.current === id) activate(tabsRef.current[Math.max(0, index - 1)]?.id ?? null)
  })
  const create = () => {
    if (!ready || operation.current) return
    const tab: Tab = { id: crypto.randomUUID(), path: null, name: 'Sans titre.md', content: '', savedContent: '', revision: '', state: 'saved' }
    mutate(tabs => [...tabs, tab]); activate(tab.id)
  }
  const edit = (id: string, content: string) => mutate(tabs => tabs.map(tab => tab.id === id ? { ...tab, content, state: tab.state === 'conflict' ? 'conflict' : tab.state === 'saving' ? 'saving' : content === tab.savedContent ? 'saved' : 'dirty' } : tab))
  const open = (path: string) => guard(async () => { const existing = tabsRef.current.find(tab => tab.path === path); if (existing) activate(existing.id); else addDocument(unwrap(await window.studio.read(path))) })
  const openFile = () => guard(async () => { const doc = unwrap(await window.studio.openFile()); if (doc) addDocument(doc) })
  const openFolder = () => guard(async () => {
    for (const tab of tabsRef.current) if (!await approveClose(tab.id)) return
    const folder = unwrap(await window.studio.openWorkspace())
    if (folder) { mutate(() => []); activate(null); setFolder(folder) }
  })
  const fileAction = (action: 'file' | 'directory' | 'rename' | 'delete', path: string) => guard(async () => {
    if (action === 'file' || action === 'directory') {
      const name = await ask({ title: action === 'file' ? 'Nouveau fichier Markdown' : 'Nouveau dossier', input: '', choices: [{ label: 'Créer', value: 'create', primary: true }] })
      if (!name) return
      const created = unwrap(await window.studio.create(path, name, action === 'file' ? 'file' : 'directory'))
      await refresh()
      if (action === 'file') addDocument(unwrap(await window.studio.read(created)))
    } else {
      const affected = tabsRef.current.filter(tab => tab.path && under(tab.path, path))
      for (const tab of affected) if (!await approveClose(tab.id)) return
      if (action === 'rename') {
        const name = await ask({ title: 'Renommer', input: nameOf(path), choices: [{ label: 'Renommer', value: 'rename', primary: true }] })
        if (!name) return
        const renamed = unwrap(await window.studio.rename(path, name))
        mutate(tabs => tabs.map(tab => tab.path && under(tab.path, path) ? { ...tab, path: renamed + tab.path.slice(path.length), name: nameOf(renamed + tab.path.slice(path.length)) } : tab))
      } else if (unwrap(await window.studio.remove(path))) {
        mutate(tabs => tabs.filter(tab => !tab.path || !under(tab.path, path)))
        if (!tabsRef.current.some(tab => tab.id === activeRef.current)) activate(tabsRef.current[0]?.id ?? null)
      }
      await refresh()
    }
  })
  const reload = (id: string) => guard(async () => {
    const tab = tabsRef.current.find(tab => tab.id === id)
    if (!tab?.path) return
    if (isDirty(tab) && await ask({ title: 'Recharger depuis le disque ?', message: 'Les modifications de cet onglet seront remplacées par la version du disque.', choices: [{ label: 'Recharger', value: 'reload', primary: true }] }) !== 'reload') return
    const doc = unwrap(await window.studio.read(tab.path))
    mutate(tabs => tabs.map(t => t.id === id ? { ...fromDisk(doc), id } : t))
  })
  useEffect(() => {
    if (!ready || !window.studio) return
    const timers = tabs.filter(tab => preferences.autosave && tab.path && tab.state === 'dirty').map(tab => setTimeout(() => { if (!operation.current) void save(tab.id) }, 900))
    return () => timers.forEach(clearTimeout)
  }, [tabs, preferences.autosave, ready, busy])
  useEffect(() => {
    if (!ready || !window.studio) return
    let checking = false
    return window.studio.onDiskChange(() => {
      if (checking || operation.current) return
      checking = true
      void (async () => {
        for (const snapshot of tabsRef.current) {
          if (!snapshot.path || inFlight.current.has(snapshot.id)) continue
          const result = await window.studio.read(snapshot.path)
          const current = tabsRef.current.find(tab => tab.id === snapshot.id)
          if (!current || current.path !== snapshot.path || inFlight.current.has(current.id)) continue
          if (!result.ok) {
            mutate(tabs => tabs.map(tab => tab.id === current.id ? { ...tab, state: 'conflict', error: result.error } : tab))
          } else if (result.value.revision !== current.revision) {
            if (isDirty(current)) mutate(tabs => tabs.map(tab => tab.id === current.id ? { ...tab, state: 'conflict', error: 'Le fichier a été modifié par une autre application.' } : tab))
            else mutate(tabs => tabs.map(tab => tab.id === current.id ? { ...fromDisk(result.value), id: tab.id } : tab))
          }
        }
        if (workspaceRef.current) { try { const folder = unwrap(await window.studio.tree()); if (JSON.stringify(folder) !== JSON.stringify(workspaceRef.current)) setFolder(folder) } catch (error) { report(error) } }
      })().finally(() => { checking = false })
    })
  }, [ready])
  useEffect(() => {
    if (!ready || !window.studio) return
    return window.studio.onCloseRequested(() => { void guard(async () => {
      for (const tab of tabsRef.current) if (!await approveClose(tab.id)) return
      unwrap(await window.studio.session(sessionSnapshot()))
      window.studio.closeReady()
    }) })
  }, [ready, preferences])
  return { tabs, activeId, active: tabs.find(tab => tab.id === activeId), workspace, preferences, ready, busy, error, setError, update: (patch: Partial<Preferences>) => setPreferences(prev => ({ ...prev, ...patch })), activate, edit, create, close, open, openFile, openFolder, fileAction, reload, save, refresh: () => guard(refresh) }
}
