export interface TunnelIngress {
  hostname: string
  service: string
  path?: string
}

// Token 模式：直接粘贴 cloudflared service install 后面的 token
// Config 模式：手动填写 UUID + 凭证 + ingress（保留兼容）
// API 模式：通过 CF API 自动创建和管理
export type TunnelMode = 'token' | 'config' | 'api'

export interface TunnelConfig {
  id: string
  name: string
  mode: TunnelMode
  // Token 模式
  token?: string
  // 从 token 解码出来的
  accountId?: string
  tunnelId?: string
  // Config 模式
  tunnel?: string        // tunnel UUID
  credentialsFile?: string
  ingress?: TunnelIngress[]
  originRequest?: Record<string, unknown>
}

export interface TunnelStatus {
  id: string
  status: 'stopped' | 'running' | 'error'
  pid?: number
  startedAt?: string
  error?: string
}

export interface AppConfig {
  cloudflaredPath: string
  autoStart: boolean
  minimizeToTray: boolean
  webPort: number
  cfApiToken?: string
}
