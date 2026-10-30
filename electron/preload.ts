import { contextBridge, ipcRenderer } from 'electron'
import type { StudioAPI } from '../shared/types'
const invoke = (method: string, ...args: unknown[]) => ipcRenderer.invoke(`studio:${method}`, ...args)
const listen = (channel: string, callback: () => void) => {
  const listener = () => callback()
  ipcRenderer.on(channel, listener)
  return () => { ipcRenderer.removeListener(channel, listener) }
}
const api: StudioAPI = {
  openFile: () => invoke('openFile'), openWorkspace: () => invoke('openWorkspace'), tree: () => invoke('tree'),
  read: path => invoke('read', path), save: document => invoke('save', document), saveAs: content => invoke('saveAs', content),
  create: (parent, name, kind) => invoke('create', parent, name, kind), rename: (path, name) => invoke('rename', path, name),
  remove: path => invoke('remove', path), restore: () => invoke('restore'), session: session => invoke('session', session),
  export: (format, html, title) => invoke('export', format, html, title), external: url => invoke('external', url),
  onDiskChange: callback => listen('studio:disk-change', callback),
  onCloseRequested: callback => listen('studio:close-requested', callback), closeReady: () => { ipcRenderer.send('studio:close-ready') }
}
contextBridge.exposeInMainWorld('studio', api)
