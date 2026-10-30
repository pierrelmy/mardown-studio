import { BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'node:fs'
import type { FileService } from './file.service'
import { stringArgument, StudioError } from './file.service'

export async function exportDocument(
  owner: BrowserWindow,
  files: FileService,
  format: unknown,
  raw: unknown,
  title: unknown,
): Promise<boolean> {
  if (format !== 'html' && format !== 'pdf') throw new StudioError('Format invalide.', 'INVALID')
  let html = stringArgument(raw, 40 * 1024 * 1024)
  const name =
    stringArgument(title, 300)
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
      .replace(/\.md$/i, '') || 'document'
  const result = await dialog.showSaveDialog(owner, {
    title: `Exporter en ${format.toUpperCase()}`,
    defaultPath: `${name}.${format}`,
    filters: [{ name: format.toUpperCase(), extensions: [format] }],
  })
  if (result.canceled || !result.filePath) return false
  // Inline only images already authorized by the workspace capability.
  const matches = [...html.matchAll(/studio-asset:\/\/local\/\?path=([^"<>\s]+)/g)]
  for (const match of matches) {
    try {
      const path = decodeURIComponent(match[1].replace(/&amp;/g, '&'))
      const bytes = await files.asset(path)
      const ext = path.split('.').pop()!.toLowerCase().replace('jpg', 'jpeg')
      html = html.replaceAll(match[0], `data:image/${ext};base64,${bytes.toString('base64')}`)
    } catch {
      html = html.replaceAll(match[0], '')
    }
  }
  if (format === 'html') {
    await fs.writeFile(result.filePath, html, 'utf8')
    return true
  }
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: false,
    },
  })
  printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdf = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
      preferCSSPageSize: true,
    })
    await fs.writeFile(result.filePath, pdf)
    return true
  } finally {
    printWindow.destroy()
  }
}
