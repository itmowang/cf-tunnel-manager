import { autoUpdater } from 'electron-updater'
import { BrowserWindow, ipcMain } from 'electron'

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // 配置 GitHub 更新源
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'itmowang',
    repo: 'cf-tunnel-manager',
  })

  const send = (channel: string, data?: unknown) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data)
    }
  }

  autoUpdater.on('checking-for-update', () => {
    send('updater:status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    send('updater:status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes,
    })
  })

  autoUpdater.on('update-not-available', () => {
    send('updater:status', { status: 'up-to-date' })
  })

  autoUpdater.on('download-progress', (progress) => {
    send('updater:status', {
      status: 'downloading',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    send('updater:status', {
      status: 'downloaded',
      version: info.version,
    })
  })

  autoUpdater.on('error', (err) => {
    send('updater:status', { status: 'error', error: err.message })
  })

  // IPC handlers
  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, version: result?.updateInfo?.version }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.handle('updater:getVersion', () => {
    return autoUpdater.currentVersion.version
  })

  // 启动后 5 秒自动检查更新
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)
}
