import electronUpdater from 'electron-updater'
import type { UpdateBackend } from './update.service'
export function createUpdateBackend(): UpdateBackend {
  const { autoUpdater } = electronUpdater
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false
  autoUpdater.fullChangelog = true
  return {
    check: async () => (await autoUpdater.checkForUpdates())?.updateInfo.version ?? null,
    download: async () => {
      await autoUpdater.downloadUpdate()
    },
    install: () => autoUpdater.quitAndInstall(false, true),
    onProgress: (callback) => {
      autoUpdater.on('download-progress', (info) => callback(info.percent))
    },
    onError: (callback) => {
      autoUpdater.on('error', (error) => callback(error.message))
    },
  }
}
