import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { BrowserWindow } from 'electron'

interface RunningTunnel {
  process: ChildProcess
  startedAt: string
  logs: string[]
}

interface TunnelConfig {
  id: string
  name: string
  mode: 'token' | 'config' | 'api'
  token?: string
  accountId?: string
  tunnelId?: string
  tunnel?: string
  credentialsFile?: string
  ingress?: Array<{ hostname: string; service: string; path?: string }>
  originRequest?: Record<string, unknown>
}

export class TunnelManager {
  private running = new Map<string, RunningTunnel>()
  private configDir: string
  private cloudflaredPath = 'cloudflared'
  private mainWindow: BrowserWindow | null = null

  constructor() {
    this.configDir = path.join(os.homedir(), '.cf-tunnel-manager', 'configs')
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true })
    }
  }

  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win
  }

  setCloudflaredPath(p: string) {
    this.cloudflaredPath = p || 'cloudflared'
  }

  private emitStatus(tunnelId: string, status: string, error?: string) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('tunnel:statusUpdate', {
        id: tunnelId,
        status,
        pid: this.running.get(tunnelId)?.process.pid,
        startedAt: this.running.get(tunnelId)?.startedAt,
        error,
      })
    }
  }

  private emitLog(tunnelId: string, line: string) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('tunnel:log', { id: tunnelId, line })
    }
  }

  private buildArgs(config: TunnelConfig): string[] {
    // Token 模式：始终用 --token 启动，ingress 由远端管理
    if (config.mode === 'token' && config.token) {
      return ['tunnel', '--no-autoupdate', 'run', '--token', config.token]
    }

    // Config 模式（手动配置文件）
    if (config.mode === 'config' && config.tunnel) {
      const yaml = this.buildYaml(config)
      const configPath = path.join(this.configDir, `${config.id}.yml`)
      fs.writeFileSync(configPath, yaml, 'utf-8')
      return ['tunnel', '--no-autoupdate', '--config', configPath, 'run']
    }

    throw new Error('无效的隧道配置')
  }

  /** 从 token 生成本地凭证文件 */
  private writeCredentials(config: TunnelConfig): string {
    const credDir = path.join(this.configDir, 'credentials')
    if (!fs.existsSync(credDir)) fs.mkdirSync(credDir, { recursive: true })

    const credPath = path.join(credDir, `${config.id}.json`)
    // Token 是 base64 编码的 JSON: { a: accountTag, t: tunnelId, s: tunnelSecret }
    try {
      const decoded = JSON.parse(Buffer.from(config.token!, 'base64').toString('utf-8'))
      const cred = {
        AccountTag: decoded.a,
        TunnelID: decoded.t,
        TunnelSecret: decoded.s,
      }
      fs.writeFileSync(credPath, JSON.stringify(cred), 'utf-8')
    } catch {
      throw new Error('Token 解码失败')
    }
    return credPath
  }

  private buildYamlFromToken(
    tunnelId: string,
    credPath: string,
    ingress: Array<{ hostname: string; service: string; path?: string }>
  ): string {
    // Windows 路径反斜杠转正斜杠，避免 YAML 解析问题
    const safePath = credPath.replace(/\\/g, '/')
    const lines: string[] = []
    lines.push(`tunnel: ${tunnelId}`)
    lines.push(`credentials-file: "${safePath}"`)
    lines.push('ingress:')
    for (const rule of ingress) {
      if (rule.hostname) {
        lines.push(`  - hostname: ${rule.hostname}`)
        lines.push(`    service: ${rule.service.replace(/\/+$/, '')}`)
        if (rule.path) lines.push(`    path: ${rule.path}`)
      } else {
        lines.push(`  - service: ${rule.service}`)
      }
    }
    // 确保有 catch-all
    const hasCatchAll = ingress.some((r) => !r.hostname)
    if (!hasCatchAll) {
      lines.push('  - service: http_status:404')
    }
    return lines.join('\n') + '\n'
  }

  private buildYaml(config: TunnelConfig): string {
    const lines: string[] = []
    lines.push(`tunnel: ${config.tunnel}`)
    if (config.credentialsFile) {
      lines.push(`credentials-file: ${config.credentialsFile}`)
    }
    if (config.ingress && config.ingress.length > 0) {
      lines.push('ingress:')
      for (const rule of config.ingress) {
        if (rule.hostname) {
          lines.push(`  - hostname: ${rule.hostname}`)
          lines.push(`    service: ${rule.service}`)
          if (rule.path) lines.push(`    path: ${rule.path}`)
        } else {
          lines.push(`  - service: ${rule.service}`)
        }
      }
    }
    return lines.join('\n') + '\n'
  }

  private attachProcessHandlers(tunnelId: string, proc: ChildProcess, tunnel: RunningTunnel) {
    const appendLog = (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        tunnel.logs.push(line)
        if (tunnel.logs.length > 500) tunnel.logs.shift()
        this.emitLog(tunnelId, line)
      }
    }

    proc.stdout?.on('data', appendLog)
    proc.stderr?.on('data', appendLog)

    proc.on('error', (err) => {
      this.running.delete(tunnelId)
      this.emitStatus(tunnelId, 'error', err.message)
    })

    proc.on('exit', (code) => {
      const lastLogs = tunnel.logs.slice(-3).join(' | ')
      this.running.delete(tunnelId)
      if (code !== 0 && code !== null) {
        this.emitStatus(tunnelId, 'error', `进程退出，代码: ${code}${lastLogs ? ' — ' + lastLogs : ''}`)
      } else {
        this.emitStatus(tunnelId, 'stopped')
      }
    })
  }

  /** 检查 cloudflared 是否可用 */
  async checkCloudflared(): Promise<{ available: boolean; version?: string; error?: string }> {
    return new Promise((resolve) => {
      try {
        const proc = spawn(this.cloudflaredPath, ['--version'], {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        })
        let output = ''
        proc.stdout?.on('data', (d) => { output += d.toString() })
        proc.stderr?.on('data', (d) => { output += d.toString() })
        proc.on('error', (err) => {
          resolve({
            available: false,
            error: `找不到 cloudflared: ${err.message}\n请在设置中配置 cloudflared.exe 的完整路径`,
          })
        })
        proc.on('exit', (code) => {
          if (code === 0) {
            const version = output.trim().split('\n')[0] || 'unknown'
            resolve({ available: true, version })
          } else {
            resolve({ available: false, error: `cloudflared 退出码: ${code}` })
          }
        })
      } catch (err: unknown) {
        resolve({ available: false, error: String(err) })
      }
    })
  }

  async start(tunnelId: string, config: TunnelConfig): Promise<{ success: boolean; error?: string }> {
    if (this.running.has(tunnelId)) {
      return { success: false, error: '隧道已在运行中' }
    }

    // 先检查 cloudflared 是否可用
    const check = await this.checkCloudflared()
    if (!check.available) {
      return { success: false, error: check.error }
    }

    try {
      const args = this.buildArgs(config)
      this.emitLog(tunnelId, `[管理器] 执行: ${this.cloudflaredPath} ${args.join(' ')}`)

      const proc = spawn(this.cloudflaredPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })

      const tunnel: RunningTunnel = {
        process: proc,
        startedAt: new Date().toISOString(),
        logs: [],
      }
      this.running.set(tunnelId, tunnel)
      this.attachProcessHandlers(tunnelId, proc, tunnel)
      this.emitStatus(tunnelId, 'running')
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  }

  async stop(tunnelId: string): Promise<{ success: boolean }> {
    const tunnel = this.running.get(tunnelId)
    if (!tunnel) return { success: true }

    return new Promise((resolve) => {
      const onExit = () => {
        this.running.delete(tunnelId)
        this.emitStatus(tunnelId, 'stopped')
        resolve({ success: true })
      }

      tunnel.process.once('exit', onExit)
      tunnel.process.kill('SIGTERM')

      // Windows 上 SIGTERM 可能不够，3 秒后强杀
      setTimeout(() => {
        if (this.running.has(tunnelId)) {
          tunnel.process.removeListener('exit', onExit)
          try { tunnel.process.kill('SIGKILL') } catch {}
          this.running.delete(tunnelId)
          this.emitStatus(tunnelId, 'stopped')
          resolve({ success: true })
        }
      }, 3000)
    })
  }

  getStatus(tunnelId: string) {
    const tunnel = this.running.get(tunnelId)
    if (!tunnel) return { status: 'stopped' as const }
    return {
      status: 'running' as const,
      pid: tunnel.process.pid,
      startedAt: tunnel.startedAt,
    }
  }

  getLogs(tunnelId: string): string[] {
    return this.running.get(tunnelId)?.logs || []
  }

  getAllStatuses(): Record<string, { status: string; pid?: number; startedAt?: string }> {
    const result: Record<string, { status: string; pid?: number; startedAt?: string }> = {}
    for (const [id, tunnel] of this.running) {
      result[id] = { status: 'running', pid: tunnel.process.pid, startedAt: tunnel.startedAt }
    }
    return result
  }

  stopAll() {
    for (const [id] of this.running) {
      this.stop(id)
    }
  }
}
