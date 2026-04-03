import { create } from 'zustand'
import type { TunnelConfig, TunnelStatus, AppConfig } from '@/types/tunnel'

interface StoreData {
  tunnels: TunnelConfig[]
  appConfig: AppConfig
}

interface TunnelStore {
  tunnels: TunnelConfig[]
  statuses: Record<string, TunnelStatus>
  logs: Record<string, string[]>
  appConfig: AppConfig
  initialized: boolean

  init: () => Promise<void>
  persist: () => void

  addTunnel: (config: TunnelConfig) => void
  removeTunnel: (id: string) => void
  updateTunnel: (id: string, config: Partial<TunnelConfig>) => void

  startTunnel: (id: string) => Promise<void>
  stopTunnel: (id: string) => Promise<void>

  setStatus: (id: string, status: TunnelStatus) => void
  appendLog: (id: string, line: string) => void
  setAppConfig: (config: Partial<AppConfig>) => void
}

export const useTunnelStore = create<TunnelStore>((set, get) => ({
  tunnels: [],
  statuses: {},
  logs: {},
  appConfig: {
    cloudflaredPath: 'cloudflared',
    autoStart: false,
    minimizeToTray: true,
    webPort: 14333,
  },
  initialized: false,

  init: async () => {
    if (get().initialized) return
    const api = window.electronAPI
    if (!api) {
      set({ initialized: true })
      return
    }

    const data: StoreData = await api.loadData()
    set({
      tunnels: data.tunnels || [],
      appConfig: { ...get().appConfig, ...data.appConfig },
      initialized: true,
    })

    api.onTunnelStatusUpdate((data: { id: string; status: string; pid?: number; startedAt?: string; error?: string }) => {
      set((state) => ({
        statuses: {
          ...state.statuses,
          [data.id]: {
            id: data.id,
            status: data.status as TunnelStatus['status'],
            pid: data.pid,
            startedAt: data.startedAt,
            error: data.error,
          },
        },
      }))
    })

    api.onTunnelLog((data: { id: string; line: string }) => {
      set((state) => {
        const existing = state.logs[data.id] || []
        const updated = [...existing, data.line]
        if (updated.length > 500) updated.splice(0, updated.length - 500)
        return { logs: { ...state.logs, [data.id]: updated } }
      })
    })
  },

  persist: () => {
    const { tunnels, appConfig } = get()
    window.electronAPI?.saveData({ tunnels, appConfig })
  },

  addTunnel: (config) => {
    set((state) => ({ tunnels: [...state.tunnels, config] }))
    get().persist()
  },

  removeTunnel: (id) => {
    const status = get().statuses[id]
    if (status?.status === 'running') {
      get().stopTunnel(id)
    }
    set((state) => ({
      tunnels: state.tunnels.filter((t) => t.id !== id),
      statuses: Object.fromEntries(Object.entries(state.statuses).filter(([k]) => k !== id)),
      logs: Object.fromEntries(Object.entries(state.logs).filter(([k]) => k !== id)),
    }))
    get().persist()
  },

  updateTunnel: (id, config) => {
    set((state) => ({
      tunnels: state.tunnels.map((t) => (t.id === id ? { ...t, ...config } : t)),
    }))
    get().persist()
  },

  startTunnel: async (id) => {
    const tunnel = get().tunnels.find((t) => t.id === id)
    if (!tunnel) return
    const result = await window.electronAPI?.startTunnel(id, tunnel)
    if (result && !result.success) {
      set((state) => ({
        statuses: {
          ...state.statuses,
          [id]: { id, status: 'error', error: result.error },
        },
      }))
    }
  },

  stopTunnel: async (id) => {
    await window.electronAPI?.stopTunnel(id)
  },

  setStatus: (id, status) =>
    set((state) => ({ statuses: { ...state.statuses, [id]: status } })),

  appendLog: (id, line) =>
    set((state) => {
      const existing = state.logs[id] || []
      return { logs: { ...state.logs, [id]: [...existing, line] } }
    }),

  setAppConfig: (config) => {
    set((state) => ({ appConfig: { ...state.appConfig, ...config } }))
    get().persist()
  },
}))
