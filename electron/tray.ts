import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'

let tray: Tray | null = null

function getIconPath(): string {
  // 开发模式
  const devPath = path.join(process.cwd(), 'public', 'icon.ico')
  if (fs.existsSync(devPath)) return devPath

  // 打包后：资源在 app.asar 同级的 dist 目录或 resources 目录
  const paths = [
    path.join(__dirname, '../dist/icon.ico'),
    path.join(__dirname, '../public/icon.ico'),
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(app.getAppPath(), 'dist/icon.ico'),
    path.join(app.getAppPath(), 'public/icon.ico'),
  ]
  for (const p of paths) {
    if (fs.existsSync(p)) return p
  }
  return ''
}

export function createTray(mainWindow: BrowserWindow) {
  const iconPath = getIconPath()
  let icon: Electron.NativeImage
  try {
    icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()
    if (icon.isEmpty() && iconPath) {
      icon = nativeImage.createEmpty()
    }
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开控制面板',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        mainWindow.destroy()
        app.quit()
      },
    },
  ])

  tray.setToolTip('CF Tunnel Manager')
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
}
