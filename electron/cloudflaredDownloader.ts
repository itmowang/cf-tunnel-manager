import path from 'path'
import fs from 'fs'
import os from 'os'
import https from 'https'
import http from 'http'
import { BrowserWindow } from 'electron'

// 主下载源 + 备用镜像
const DOWNLOAD_URLS = [
  'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
  'https://ghproxy.cc/https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
]

export function getDefaultCloudflaredPath(): string {
  const dir = path.join(os.homedir(), '.cf-tunnel-manager', 'bin')
  return path.join(dir, 'cloudflared.exe')
}

export function isCloudflaredDownloaded(): boolean {
  return fs.existsSync(getDefaultCloudflaredPath())
}

function httpGet(url: string): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, { timeout: 15000 }, resolve)
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('连接超时'))
    })
  })
}

async function tryDownload(
  url: string,
  targetPath: string,
  sendProgress: (percent: number, status: string) => void,
): Promise<{ success: boolean; error?: string }> {
  let redirectCount = 0
  let currentUrl = url

  // 跟随重定向
  while (redirectCount < 10) {
    const res = await httpGet(currentUrl)

    if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      currentUrl = res.headers.location
      redirectCount++
      sendProgress(0, `重定向中... (${redirectCount})`)
      res.resume() // 消费掉 body
      continue
    }

    if (res.statusCode !== 200) {
      res.resume()
      return { success: false, error: `HTTP ${res.statusCode}` }
    }

    // 开始下载
    const totalSize = parseInt(res.headers['content-length'] || '0', 10)
    let downloaded = 0

    return new Promise((resolve) => {
      const tmpPath = targetPath + '.tmp'
      const file = fs.createWriteStream(tmpPath)

      res.on('data', (chunk: Buffer) => {
        downloaded += chunk.length
        if (totalSize > 0) {
          const percent = Math.round((downloaded / totalSize) * 100)
          const mb = (downloaded / 1024 / 1024).toFixed(1)
          const totalMb = (totalSize / 1024 / 1024).toFixed(1)
          sendProgress(percent, `下载中 ${mb}MB / ${totalMb}MB`)
        } else {
          const mb = (downloaded / 1024 / 1024).toFixed(1)
          sendProgress(-1, `下载中 ${mb}MB`)
        }
      })

      res.pipe(file)

      file.on('finish', () => {
        file.close(() => {
          // 下载完成，重命名
          try {
            if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath)
            fs.renameSync(tmpPath, targetPath)
            resolve({ success: true })
          } catch (err) {
            resolve({ success: false, error: `文件写入失败: ${err}` })
          }
        })
      })

      file.on('error', (err) => {
        file.close()
        try { fs.unlinkSync(tmpPath) } catch {}
        resolve({ success: false, error: `写入出错: ${err.message}` })
      })

      res.on('error', (err) => {
        file.close()
        try { fs.unlinkSync(tmpPath) } catch {}
        resolve({ success: false, error: `下载出错: ${err.message}` })
      })
    })
  }

  return { success: false, error: '重定向次数过多' }
}

export async function downloadCloudflared(
  mainWindow: BrowserWindow | null
): Promise<{ success: boolean; path?: string; error?: string }> {
  const targetDir = path.join(os.homedir(), '.cf-tunnel-manager', 'bin')
  const targetPath = path.join(targetDir, 'cloudflared.exe')

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  const sendProgress = (percent: number, status: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cloudflared:downloadProgress', { percent, status })
    }
  }

  const errors: string[] = []

  for (let i = 0; i < DOWNLOAD_URLS.length; i++) {
    const url = DOWNLOAD_URLS[i]
    const label = i === 0 ? 'GitHub' : `镜像 ${i}`
    sendProgress(0, `正在尝试从 ${label} 下载...`)

    try {
      const result = await tryDownload(url, targetPath, sendProgress)
      if (result.success) {
        sendProgress(100, '下载完成')
        return { success: true, path: targetPath }
      }
      errors.push(`${label}: ${result.error}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${label}: ${msg}`)
    }

    sendProgress(0, `${label} 下载失败，尝试备用源...`)
  }

  return { success: false, error: `所有下载源均失败:\n${errors.join('\n')}` }
}
