import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron'
import { join } from 'node:path'
import { FileService, stringArgument, StudioError } from './services/file.service'
import { loadSession, parseSession, writeSession } from './services/session.service'
import { exportDocument } from './services/export.service'
import type { Result, Session } from '../shared/types'

protocol.registerSchemesAsPrivileged([{ scheme: 'studio-asset', privileges: { standard: true, secure: true, supportFetchAPI: true } }])
const files = new FileService()
let window: BrowserWindow | null = null
let allowClose = false
let closing = false
let persistQueue = Promise.resolve()
let sessionPath: string
function createWindow() {
  const win = new BrowserWindow({ width: 1440, height: 940, minWidth: 900, minHeight: 600, backgroundColor: '#1c1e25', title: 'Markdown Studio', webPreferences: { preload: join(import.meta.dirname, '../preload/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  window = win
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', event => event.preventDefault())
  win.webContents.on('will-attach-webview', event => event.preventDefault())
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  win.on('close', event => {
    if (allowClose) return
    event.preventDefault()
    if (closing) return
    closing = true
    win.webContents.send('studio:close-requested')
    // A nonresponsive renderer must never silently discard edits.
    setTimeout(() => { closing = false }, 1000)
  })
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  return win
}
function register(method: string, handler: (...args: unknown[]) => Promise<unknown>) {
  ipcMain.handle(`studio:${method}`, async (event, ...args): Promise<Result<unknown>> => {
    try {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new StudioError('Origine IPC refusée.', 'DENIED')
      return { ok: true, value: await handler(...args) }
    } catch (error) {
      const code = error instanceof StudioError ? error.code : (error as NodeJS.ErrnoException).code
      const message = code === 'ENOENT' ? 'Ce fichier ou dossier n’existe plus.' : code === 'EACCES' || code === 'EPERM' ? 'Accès refusé par le système.' : code === 'EEXIST' ? 'Ce nom existe déjà.' : error instanceof Error ? error.message : 'Une erreur est survenue.'
      return { ok: false, error: message, code }
    }
  })
}
app.whenReady().then(async () => {
  sessionPath = join(app.getPath('userData'), 'session.json')
  await protocol.handle('studio-asset', async request => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== 'local') return new Response(null, { status: 403 })
      const path = url.searchParams.get('path') ?? ''
      const buffer = await files.asset(path)
      const ext = path.split('.').pop()!.toLowerCase().replace('jpg', 'jpeg')
      return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': `image/${ext}`, 'Content-Security-Policy': "default-src 'none'" } })
    } catch { return new Response(null, { status: 403 }) }
  })
  register('openFile', async () => {
    const choice = await dialog.showOpenDialog(window!, { properties: ['openFile'], filters: [{ name: 'Markdown', extensions: ['md'] }] })
    if (choice.canceled || !choice.filePaths[0]) return null
    return files.read(await files.grantFile(choice.filePaths[0]))
  })
  register('openWorkspace', async () => {
    const choice = await dialog.showOpenDialog(window!, { properties: ['openDirectory', 'createDirectory'] })
    return choice.canceled || !choice.filePaths[0] ? null : files.openWorkspace(choice.filePaths[0])
  })
  register('tree', async () => files.workspace ? { path: files.workspace, tree: await files.tree() } : null)
  register('read', async path => files.read(path))
  register('save', async document => files.save(document))
  register('saveAs', async content => {
    const text = stringArgument(content, 20 * 1024 * 1024)
    const choice = await dialog.showSaveDialog(window!, { defaultPath: 'Sans titre.md', filters: [{ name: 'Markdown', extensions: ['md'] }] })
    if (choice.canceled || !choice.filePath) return null
    if (!/\.md$/i.test(choice.filePath)) throw new StudioError('L’extension .md est requise.', 'INVALID')
    // The native save dialog explicitly authorizes this target, including replacement.
    const { promises: fs } = await import('node:fs')
    try { await fs.writeFile(choice.filePath, '', { flag: 'wx' }) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
    const path = await files.grantFile(choice.filePath)
    const disk = await files.read(path)
    return files.save({ ...disk, content: text })
  })
  register('create', async (parent, name, kind) => files.create(parent, name, kind))
  register('rename', async (path, name) => files.rename(path, name))
  register('remove', async path => {
    const canonical = await files.removable(path)
    const choice = await dialog.showMessageBox(window!, { type: 'warning', title: 'Supprimer', message: 'Déplacer cet élément dans la corbeille ?', detail: canonical, buttons: ['Annuler', 'Mettre à la corbeille'], defaultId: 0, cancelId: 0, noLink: true })
    if (choice.response !== 1) return false
    await shell.trashItem(canonical)
    return true
  })
  register('restore', async () => {
    const session = await loadSession(sessionPath)
    let workspace = null
    try { if (session.workspace) workspace = await files.openWorkspace(session.workspace) } catch { session.workspace = null }
    const documents = []
    for (const path of session.paths) { try { documents.push(await files.read(await files.grantFile(path))) } catch { /* missing files are omitted */ } }
    return { session, workspace, documents }
  })
  register('session', async raw => {
    const requested = parseSession(raw)
    const paths: string[] = []
    for (const path of requested.paths) { try { paths.push(await files.authorize(path)) } catch { /* never persist ungranted capabilities */ } }
    const session: Session = { ...requested, workspace: files.workspace, paths, activePath: paths.includes(requested.activePath ?? '') ? requested.activePath : null }
    persistQueue = persistQueue.catch(() => {}).then(() => writeSession(sessionPath, session))
    await persistQueue
  })
  register('external', async raw => {
    const url = new URL(stringArgument(raw, 8192))
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new StudioError('Lien refusé.', 'DENIED')
    await shell.openExternal(url.toString())
  })
  register('export', async (format, html, title) => exportDocument(window!, files, format, html, title))
  ipcMain.on('studio:close-ready', async event => {
    if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame) return
    await persistQueue.catch(() => {})
    allowClose = true
    window.close()
  })
  createWindow()
  const poll = setInterval(() => { if (window && !window.isDestroyed()) window.webContents.send('studio:disk-change') }, 2500)
  poll.unref()
})
app.on('window-all-closed', () => app.quit())
