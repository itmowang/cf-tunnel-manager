import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import yaml from 'js-yaml'
import { createTray } from './tray'
import { TunnelManager } from './tunnelManager'
import { loadData, saveData } from './configStore'
import { downloadCloudflared, getDefaultCloudflaredPath, isCloudflaredDownloaded } from './cloudflaredDownloader'
import { decodeToken, getTunnelConfig, updateTunnelConfig, verifyToken, listZones, listDnsRecords, listAccounts, listTunnels, getTunnelToken, ensureTunnelDns, createTunnel } from './cloudflareApi'
import { setupAutoUpdater } from './updater'

let mainWindow: BrowserWindow | null = null
const tunnelManager = new TunnelManager()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    icon: path.join(process.env.VITE_PUBLIC || path.join(__dirname, '../public'), 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'CF Tunnel Manager',
  })

  tunnelManager.setMainWindow(mainWindow)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', (e) => {
    const data = loadData()
    if (data.appConfig.minimizeToTray) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })
}

function registerIpcHandlers() {
  // ---- 窗口控制 ----
  ipcMain.handle('window:minimize', () => { mainWindow?.minimize() })
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
    return mainWindow?.isMaximized()
  })
  ipcMain.handle('window:close', () => { mainWindow?.close() })
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized())

  // ---- 数据持久化 ----
  ipcMain.handle('store:load', () => {
    return loadData()
  })

  ipcMain.handle('store:save', (_e, data) => {
    saveData(data)
    tunnelManager.setCloudflaredPath(data.appConfig?.cloudflaredPath)
  })

  // ---- 隧道操作 ----
  ipcMain.handle('tunnel:start', async (_e, tunnelId: string, config) => {
    return tunnelManager.start(tunnelId, config)
  })

  ipcMain.handle('tunnel:stop', async (_e, tunnelId: string) => {
    return tunnelManager.stop(tunnelId)
  })

  ipcMain.handle('tunnel:status', (_e, tunnelId: string) => {
    return tunnelManager.getStatus(tunnelId)
  })

  ipcMain.handle('tunnel:allStatuses', () => {
    return tunnelManager.getAllStatuses()
  })

  ipcMain.handle('tunnel:logs', (_e, tunnelId: string) => {
    return tunnelManager.getLogs(tunnelId)
  })

  // ---- 文件对话框 ----
  ipcMain.handle('dialog:selectConfigFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'YAML', extensions: ['yml', 'yaml'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (result.filePaths[0]) {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8')
      return { path: result.filePaths[0], content }
    }
    return null
  })

  ipcMain.handle('dialog:selectExecutable', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Executable', extensions: ['exe', ''] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return result.filePaths[0] || null
  })

  // ---- cloudflared 检测 ----
  ipcMain.handle('cloudflared:check', async () => {
    return tunnelManager.checkCloudflared()
  })

  ipcMain.handle('cloudflared:download', async () => {
    const result = await downloadCloudflared(mainWindow)
    if (result.success && result.path) {
      // 自动设置路径
      tunnelManager.setCloudflaredPath(result.path)
      const data = loadData()
      data.appConfig.cloudflaredPath = result.path
      saveData(data)
    }
    return result
  })

  ipcMain.handle('cloudflared:getDefaultPath', () => {
    return { path: getDefaultCloudflaredPath(), exists: isCloudflaredDownloaded() }
  })

  // ---- 解析 YAML ----
  ipcMain.handle('config:parseYaml', (_e, content: string) => {
    try {
      return { success: true, data: yaml.load(content) }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ---- Cloudflare API ----
  ipcMain.handle('cf:decodeToken', (_e, token: string) => {
    return decodeToken(token)
  })

  ipcMain.handle('cf:verifyToken', async (_e, apiToken: string) => {
    return verifyToken(apiToken)
  })

  ipcMain.handle('cf:listAccounts', async (_e, apiToken: string) => {
    return listAccounts(apiToken)
  })

  ipcMain.handle('cf:listTunnels', async (_e, accountId: string, apiToken: string) => {
    return listTunnels(accountId, apiToken)
  })

  ipcMain.handle('cf:createTunnel', async (_e, accountId: string, name: string, apiToken: string) => {
    return createTunnel(accountId, name, apiToken)
  })

  ipcMain.handle('cf:getTunnelToken', async (_e, accountId: string, tunnelId: string, apiToken: string) => {
    return getTunnelToken(accountId, tunnelId, apiToken)
  })

  ipcMain.handle('cf:listZones', async (_e, apiToken: string) => {
    return listZones(apiToken)
  })

  ipcMain.handle('cf:listDnsRecords', async (_e, zoneId: string, apiToken: string) => {
    return listDnsRecords(zoneId, apiToken)
  })

  ipcMain.handle('cf:getIngress', async (_e, accountId: string, tunnelId: string, apiToken: string) => {
    return getTunnelConfig(accountId, tunnelId, apiToken)
  })

  ipcMain.handle('cf:updateIngress', async (_e, accountId: string, tunnelId: string, apiToken: string, ingress: unknown[]) => {
    return updateTunnelConfig(accountId, tunnelId, apiToken, ingress as any)
  })

  ipcMain.handle('cf:ensureDns', async (_e, tunnelId: string, hostnames: string[], removedHostnames: string[], apiToken: string, zones: Array<{ id: string; name: string }>) => {
    return ensureTunnelDns(tunnelId, hostnames, removedHostnames, apiToken, zones)
  })
}

app.whenReady().then(() => {
  createWindow()
  if (mainWindow) {
    createTray(mainWindow)
    setupAutoUpdater(mainWindow)
  }
  registerIpcHandlers()

  // 加载 cloudflared 路径
  const data = loadData()
  tunnelManager.setCloudflaredPath(data.appConfig.cloudflaredPath)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    tunnelManager.stopAll()
    app.quit()
  }
})

app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
  } else {
    mainWindow.show()
  }
})

app.on('before-quit', () => {
  tunnelManager.stopAll()
})
