import { useState } from 'react'
import { Play, Square, Trash2, ScrollText, Key, Globe } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import type { TunnelConfig, TunnelStatus } from '@/types/tunnel'
import { useTunnelStore } from '@/store/tunnelStore'
import { IngressManager } from '@/components/IngressManager'

interface TunnelCardProps {
  tunnel: TunnelConfig
  status?: TunnelStatus
}

export function TunnelCard({ tunnel, status }: TunnelCardProps) {
  const { removeTunnel, startTunnel, stopTunnel, updateTunnel } = useTunnelStore()
  const navigate = useNavigate()
  const isRunning = status?.status === 'running'
  const isError = status?.status === 'error'
  const [showIngress, setShowIngress] = useState(false)
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [tokenInput, setTokenInput] = useState('')

  const hasToken = !!tunnel.token

  const handleStart = async () => {
    if (!hasToken) {
      setShowTokenInput(true)
      return
    }
    await startTunnel(tunnel.id)
  }

  const handleSaveToken = async () => {
    let cleanToken = tokenInput.trim()
    const match = cleanToken.match(/(?:--token\s+|service\s+install\s+)(\S+)/i)
    if (match) cleanToken = match[1]

    if (!cleanToken) return

    const decoded = await window.electronAPI?.decodeToken(cleanToken)
    updateTunnel(tunnel.id, {
      token: cleanToken,
      accountId: decoded?.accountId || tunnel.accountId,
      tunnelId: decoded?.tunnelId || tunnel.tunnelId,
    })
    setShowTokenInput(false)
    setTokenInput('')
    // 保存后自动启动
    setTimeout(() => startTunnel(tunnel.id), 200)
  }

  return (
    <>
      <Card className={isError ? 'border-destructive/50' : ''}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base truncate">{tunnel.name}</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {tunnel.tunnelId ? `${tunnel.tunnelId.slice(0, 8)}...` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-2 shrink-0">
            {!hasToken && (
              <Badge variant="outline" className="text-xs">需要 Token</Badge>
            )}
            <Badge
              variant={isRunning ? 'success' : isError ? 'destructive' : 'secondary'}
            >
              {isRunning ? '运行中' : isError ? '错误' : '已停止'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {status?.error && (
            <p className="text-xs text-destructive mb-3 bg-destructive/10 rounded p-2">{status.error}</p>
          )}

          {/* Token 输入区域 */}
          {showTokenInput && (
            <div className="mb-3 space-y-2 p-3 rounded-md border bg-muted/30">
              <p className="text-xs text-muted-foreground">粘贴此隧道的 Token 或安装命令：</p>
              <Textarea
                placeholder="eyJhIjo... 或 cloudflared service install eyJhIjo..."
                rows={2}
                className="font-mono text-xs"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveToken} disabled={!tokenInput.trim()}>
                  保存并启动
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowTokenInput(false)}>
                  取消
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isRunning ? (
              <Button size="sm" variant="outline" onClick={() => stopTunnel(tunnel.id)}>
                <Square className="mr-1 h-3 w-3" /> 停止
              </Button>
            ) : (
              <Button size="sm" onClick={handleStart}>
                <Play className="mr-1 h-3 w-3" /> 启动
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowIngress(true)}>
              <Globe className="mr-1 h-3 w-3" /> 端口映射
            </Button>
            {!hasToken && !showTokenInput && (
              <Button size="sm" variant="outline" onClick={() => setShowTokenInput(true)}>
                <Key className="mr-1 h-3 w-3" /> 填写 Token
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => navigate('/logs')} title="查看日志">
              <ScrollText className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removeTunnel(tunnel.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <IngressManager tunnel={tunnel} open={showIngress} onOpenChange={setShowIngress} />
    </>
  )
}
