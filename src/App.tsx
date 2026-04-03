import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { TitleBar } from '@/components/TitleBar'
import { Sidebar } from '@/components/Sidebar'
import { SetupGuard } from '@/components/SetupGuard'
import Dashboard from '@/pages/Dashboard'
import SettingsPage from '@/pages/SettingsPage'
import LogsPage from '@/pages/LogsPage'
import { useTunnelStore } from '@/store/tunnelStore'
import { Toaster } from '@/components/ui/toaster'

export default function App() {
  const init = useTunnelStore((s) => s.init)

  useEffect(() => {
    init()
  }, [init])

  return (
    <div className="flex flex-col h-screen">
      <TitleBar />
      <SetupGuard>
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
        <Toaster />
      </SetupGuard>
    </div>
  )
}
