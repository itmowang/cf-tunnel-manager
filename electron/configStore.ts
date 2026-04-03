import fs from 'fs'
import path from 'path'
import os from 'os'

const DATA_DIR = path.join(os.homedir(), '.cf-tunnel-manager')
const CONFIG_FILE = path.join(DATA_DIR, 'app-data.json')

export interface PersistedData {
  tunnels: unknown[]
  appConfig: {
    cloudflaredPath: string
    autoStart: boolean
    minimizeToTray: boolean
    webPort: number
    cfApiToken?: string
  }
}

const defaultData: PersistedData = {
  tunnels: [],
  appConfig: {
    cloudflaredPath: 'cloudflared',
    autoStart: false,
    minimizeToTray: true,
    webPort: 14333,
    cfApiToken: '',
  },
}

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

export function loadData(): PersistedData {
  ensureDataDir()
  if (!fs.existsSync(CONFIG_FILE)) return { ...defaultData }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
    return { ...defaultData, ...JSON.parse(raw) }
  } catch {
    return { ...defaultData }
  }
}

export function saveData(data: PersistedData) {
  ensureDataDir()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8')
}
