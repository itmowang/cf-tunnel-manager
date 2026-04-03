import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Settings, Cloud, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTunnelStore } from '@/store/tunnelStore'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '控制面板' },
  { to: '/logs', icon: ScrollText, label: '运行日志' },
  { to: '/settings', icon: Settings, label: '设置' },
]

export function Sidebar() {
  const statuses = useTunnelStore((s) => s.statuses)
  const runningCount = Object.values(statuses).filter((s) => s.status === 'running').length
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.electronAPI?.getAppVersion().then(v => setVersion(v || ''))
  }, [])

  return (
    <aside className="w-56 border-r bg-card flex flex-col">
      <div className="p-4 border-b flex items-center gap-2">
        <Cloud className="h-6 w-6 text-orange-500" />
        <span className="font-bold text-lg">CF Tunnel</span>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t">
        {runningCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-green-600 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            {runningCount} 个隧道运行中
          </div>
        )}
        <p className="text-xs text-muted-foreground">v{version}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          © <a href="https://github.com/itmowang" target="_blank" rel="noopener" className="hover:underline">魔王</a>
        </p>
      </div>
    </aside>
  )
}
