import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTunnelStore } from '@/store/tunnelStore'
import { Trash2 } from 'lucide-react'

export default function LogsPage() {
  const { tunnels, logs, statuses } = useTunnelStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const selected = selectedId || tunnels[0]?.id
  const currentLogs = selected ? logs[selected] || [] : []

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentLogs.length])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">运行日志</h1>
        <p className="text-muted-foreground">查看隧道的实时输出日志</p>
      </div>

      {tunnels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            还没有隧道配置
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-4 h-[calc(100vh-200px)]">
          {/* 隧道列表 */}
          <div className="w-48 space-y-1 shrink-0">
            {tunnels.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selected === t.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{t.name}</span>
                  <Badge
                    variant={statuses[t.id]?.status === 'running' ? 'success' : 'secondary'}
                    className="ml-1 scale-75"
                  >
                    {statuses[t.id]?.status === 'running' ? '●' : '○'}
                  </Badge>
                </div>
              </button>
            ))}
          </div>

          {/* 日志内容 */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between py-3 shrink-0">
              <CardTitle className="text-base">
                {tunnels.find((t) => t.id === selected)?.name || '选择隧道'}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {currentLogs.length} 行
              </span>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <div className="font-mono text-xs p-4 space-y-0.5 bg-neutral-950 text-neutral-300 min-h-full">
                {currentLogs.length === 0 ? (
                  <p className="text-neutral-500">暂无日志，启动隧道后将在此显示...</p>
                ) : (
                  currentLogs.map((line, i) => (
                    <div
                      key={i}
                      className={`leading-5 ${
                        line.toLowerCase().includes('error')
                          ? 'text-red-400'
                          : line.toLowerCase().includes('warn')
                          ? 'text-yellow-400'
                          : line.toLowerCase().includes('connected')
                          ? 'text-green-400'
                          : ''
                      }`}
                    >
                      {line}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
