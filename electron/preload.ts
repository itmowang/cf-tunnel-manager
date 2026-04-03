import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // 数据持久化
  loadData: () => ipcRenderer.invoke('store:load'),
  saveData: (data: unknown) => ipcRenderer.invoke('store:save', data),

  // 隧道操作
  startTunnel: (tunnelId: string, config: unknown) =>
    ipcRenderer.invoke('tunnel:start', tunnelId, config),
  stopTunnel: (tunnelId: string) =>
    ipcRenderer.invoke('tunnel:stop', tunnelId),
  getTunnelStatus: (tunnelId: string) =>
    ipcRenderer.invoke('tunnel:status', tunnelId),
  getAllStatuses: () =>
    ipcRenderer.invoke('tunnel:allStatuses'),
  getTunnelLogs: (tunnelId: string) =>
    ipcRenderer.invoke('tunnel:logs', tunnelId),

  // 文件对话框
  selectConfigFile: () =>
    ipcRenderer.invoke('dialog:selectConfigFile'),
  selectExecutable: () =>
    ipcRenderer.invoke('dialog:selectExecutable'),

  // YAML 解析
  parseYaml: (content: string) =>
    ipcRenderer.invoke('config:parseYaml', content),

  // Cloudflare API
  decodeToken: (token: string) =>
    ipcRenderer.invoke('cf:decodeToken', token),
  verifyToken: (apiToken: string) =>
    ipcRenderer.invoke('cf:verifyToken', apiToken),
  listAccounts: (apiToken: string) =>
    ipcRenderer.invoke('cf:listAccounts', apiToken),
  listTunnels: (accountId: string, apiToken: string) =>
    ipcRenderer.invoke('cf:listTunnels', accountId, apiToken),
  getTunnelToken: (accountId: string, tunnelId: string, apiToken: string) =>
    ipcRenderer.invoke('cf:getTunnelToken', accountId, tunnelId, apiToken),
  listZones: (apiToken: string) =>
    ipcRenderer.invoke('cf:listZones', apiToken),
  listDnsRecords: (zoneId: string, apiToken: string) =>
    ipcRenderer.invoke('cf:listDnsRecords', zoneId, apiToken),
  getIngress: (accountId: string, tunnelId: string, apiToken: string) =>
    ipcRenderer.invoke('cf:getIngress', accountId, tunnelId, apiToken),
  updateIngress: (accountId: string, tunnelId: string, apiToken: string, ingress: unknown[]) =>
    ipcRenderer.invoke('cf:updateIngress', accountId, tunnelId, apiToken, ingress),
  ensureDns: (tunnelId: string, hostnames: string[], removedHostnames: string[], apiToken: string, zones: Array<{ id: string; name: string }>) =>
    ipcRenderer.invoke('cf:ensureDns', tunnelId, hostnames, removedHostnames, apiToken, zones),

  // cloudflared 检测与下载
  checkCloudflared: () =>
    ipcRenderer.invoke('cloudflared:check'),
  downloadCloudflared: () =>
    ipcRenderer.invoke('cloudflared:download'),
  getDefaultCloudflaredPath: () =>
    ipcRenderer.invoke('cloudflared:getDefaultPath'),
  onDownloadProgress: (callback: (data: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => callback(data)
    ipcRenderer.on('cloudflared:downloadProgress', handler)
    return () => ipcRenderer.removeListener('cloudflared:downloadProgress', handler)
  },

  // 事件监听
  onTunnelStatusUpdate: (callback: (data: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => callback(data)
    ipcRenderer.on('tunnel:statusUpdate', handler)
    return () => ipcRenderer.removeListener('tunnel:statusUpdate', handler)
  },
  onTunnelLog: (callback: (data: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => callback(data)
    ipcRenderer.on('tunnel:log', handler)
    return () => ipcRenderer.removeListener('tunnel:log', handler)
  },
})
