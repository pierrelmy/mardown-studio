import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'

let window: BrowserWindow
app.whenReady().then(() => {
  window = new BrowserWindow({ width: 1440, height: 940, minWidth: 900, minHeight: 600, backgroundColor: '#181a20', title: 'Markdown Studio', webPreferences: { preload: join(import.meta.dirname, '../preload/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
})
app.on('window-all-closed', () => app.quit())
