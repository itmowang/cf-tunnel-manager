export interface ElectronAPI {
  // 窗口控制
  minimize: () => Promise<void>
  maximize: () => Promise<boolean>
  closeWindow: () => Promise<void>
  isMaximized: () => Promise<boolean>

  // 数据持久化
  loadData: () => Promise<{ tunnels: unknown[]; appConfig: Record<string, unknown> }>
  saveData: (data: unknown) => Promise<void>

  // 隧道操作
  startTunnel: (tunnelId: string, config: unknown) => Promise<{ success: boolean; error?: string }>
  stopTunnel: (tunnelId: string) => Promise<{ success: boolean }>
  getTunnelStatus: (tunnelId: string) => Promise<{ status: string; pid?: number; startedAt?: string }>
  getAllStatuses: () => Promise<Record<string, { status: string; pid?: number; startedAt?: string }>>
  getTunnelLogs: (tunnelId: string) => Promise<string[]>

  // 文件对话框
  selectConfigFile: () => Promise<{ path: string; content: string } | null>
  selectExecutable: () => Promise<string | null>

  // YAML 解析
  parseYaml: (content: string) => Promise<{ success: boolean; data?: unknown; error?: string }>

  // Cloudflare API
  decodeToken: (token: string) => Promise<{ accountId: string; tunnelId: string; secret: string } | null>
  verifyToken: (apiToken: string) => Promise<{ success: boolean; error?: string }>
  listAccounts: (apiToken: string) => Promise<{ success: boolean; accounts?: Array<{ id: string; name: string }>; error?: string }>
  listTunnels: (accountId: string, apiToken: string) => Promise<{ success: boolean; tunnels?: Array<{ id: string; name: string; status: string; created_at: string }>; error?: string }>
  getTunnelToken: (accountId: string, tunnelId: string, apiToken: string) => Promise<{ success: boolean; token?: string; error?: string }>
  listZones: (apiToken: string) => Promise<{ success: boolean; zones?: Array<{ id: string; name: string; status: string }>; error?: string }>
  listDnsRecords: (zoneId: string, apiToken: string) => Promise<{ success: boolean; records?: Array<{ id: string; name: string; type: string; content: string; proxied: boolean }>; error?: string }>
  getIngress: (accountId: string, tunnelId: string, apiToken: string) => Promise<{ success: boolean; ingress?: Array<{ hostname?: string; service: string; path?: string }>; error?: string }>
  updateIngress: (accountId: string, tunnelId: string, apiToken: string, ingress: unknown[]) => Promise<{ success: boolean; error?: string }>
  ensureDns: (tunnelId: string, hostnames: string[], removedHostnames: string[], apiToken: string, zones: Array<{ id: string; name: string }>) => Promise<{ created: string[]; removed: string[]; errors: string[] }>

  // cloudflared 检测与下载
  checkCloudflared: () => Promise<{ available: boolean; version?: string; error?: string }>
  downloadCloudflared: () => Promise<{ success: boolean; path?: string; error?: string }>
  getDefaultCloudflaredPath: () => Promise<{ path: string; exists: boolean }>
  onDownloadProgress: (callback: (data: any) => void) => () => void

  // 事件监听
  onTunnelStatusUpdate: (callback: (data: any) => void) => () => void
  onTunnelLog: (callback: (data: any) => void) => () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
