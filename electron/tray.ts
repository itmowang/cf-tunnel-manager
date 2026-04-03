import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron'
import path from 'path'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow) {
  // 使用应用图标
  const iconPath = path.join(
    process.env.VITE_PUBLIC || path.join(__dirname, '../public'),
    'icon.ico'
  )
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
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
