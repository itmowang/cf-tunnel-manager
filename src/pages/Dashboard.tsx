import { useState, useEffect } from 'react'
import { Activity, RefreshCw, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTunnelStore } from '@/store/tunnelStore'
import { TunnelCard } from '@/components/TunnelCard'
import { AddTunnelDialog } from '@/components/AddTunnelDialog'

export default function Dashboard() {
  const { tunnels, statuses, addTunnel, updateTunnel } = useTunnelStore()
  const [showAdd, setShowAdd] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncError, setSyncError] = useState('')

  const apiToken = useTunnelStore((s) => s.appConfig.cfApiToken) || ''
  const runningCount = Object.values(statuses).filter((s) => s.status === 'running').length

  // 有 API Token 时自动同步远端隧道
  const syncTunnels = async () => {
    if (!apiToken) return
    setSyncing(true)
    setSyncError('')

    // 1. 获取账户
    const accResult = await window.electronAPI?.listAccounts(apiToken)
    if (!accResult?.success || !accResult.accounts?.length) {
      setSyncing(false)
      setSyncError(accResult?.error || '获取账户失败，请检查 API Token 权限（需要 Account 读取权限）')
      return
    }

    let syncCount = 0

    // 2. 遍历所有账户获取隧道
    for (const account of accResult.accounts) {
      const tunnelResult = await window.electronAPI?.listTunnels(account.id, apiToken)
      if (!tunnelResult?.success || !tunnelResult.tunnels) {
        setSyncError((prev) => prev + (prev ? '\n' : '') + `账户 ${account.name}: ${tunnelResult?.error || '获取隧道失败'}`)
        continue
      }

      for (const cfTunnel of tunnelResult.tunnels) {
        // 尝试获取 token
        let tunnelToken: string | undefined
        let decodedAccountId = account.id
        const tokenResult = await window.electronAPI?.getTunnelToken(account.id, cfTunnel.id, apiToken)
        if (tokenResult?.success && tokenResult.token) {
          tunnelToken = tokenResult.token
          const decoded = await window.electronAPI?.decodeToken(tokenResult.token)
          if (decoded) decodedAccountId = decoded.accountId
        }

        // 已存在的：补上缺失的 token 和 ID
        const existing = tunnels.find((t) => t.tunnelId === cfTunnel.id)
        if (existing) {
          const updates: Partial<typeof existing> = {}
          if (!existing.token && tunnelToken) updates.token = tunnelToken
          if (!existing.accountId) updates.accountId = decodedAccountId
          if (!existing.tunnelId) updates.tunnelId = cfTunnel.id
          if (Object.keys(updates).length > 0) {
            updateTunnel(existing.id, updates)
            syncCount++
          }
          continue
        }

        addTunnel({
          id: crypto.randomUUID(),
          name: cfTunnel.name,
          mode: 'token',
          token: tunnelToken,
          accountId: decodedAccountId,
          tunnelId: cfTunnel.id,
        })
        syncCount++
      }
    }

    setSyncing(false)
    setLastSync(`${new Date().toLocaleTimeString()} (新增 ${syncCount} 个)`)
  }

  useEffect(() => {
    if (apiToken) syncTunnels()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">控制面板</h1>
          <p className="text-muted-foreground">
            管理你的 Cloudflare Tunnel
            {lastSync && <span className="ml-2 text-xs">· 上次同步 {lastSync}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {apiToken && (
            <Button variant="outline" onClick={syncTunnels} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? '同步中...' : '同步隧道'}
            </Button>
          )}
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加隧道
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">隧道总数</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tunnels.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">运行中</CardTitle>
            <Badge variant="success">{runningCount}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{runningCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已停止</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tunnels.length - runningCount}</div>
          </CardContent>
        </Card>
      </div>

      {syncError && (
        <Card className="border-destructive/50">
          <CardContent className="py-3">
            <p className="text-sm text-destructive whitespace-pre-line">{syncError}</p>
            <p className="text-xs text-muted-foreground mt-2">
              API Token 需要以下权限：Account &gt; Cloudflare Tunnel: Read、Zone: Read
            </p>
          </CardContent>
        </Card>
      )}

      {tunnels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            {apiToken ? (
              <>
                <CardDescription className="text-center mb-4">
                  {syncing ? '正在从 Cloudflare 同步隧道...' : '没有找到隧道'}
                </CardDescription>
                {!syncing && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={syncTunnels}>
                      <RefreshCw className="mr-2 h-4 w-4" /> 重新同步
                    </Button>
                    <Button onClick={() => setShowAdd(true)}>
                      <Plus className="mr-2 h-4 w-4" /> 手动添加
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <CardDescription className="text-center mb-4">
                  在设置中配置 API Token 后，会自动同步你的所有隧道
                </CardDescription>
                <Button onClick={() => setShowAdd(true)}>
                  <Plus className="mr-2 h-4 w-4" /> 手动添加隧道
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tunnels.map((tunnel) => (
            <TunnelCard key={tunnel.id} tunnel={tunnel} status={statuses[tunnel.id]} />
          ))}
        </div>
      )}

      <AddTunnelDialog open={showAdd} onOpenChange={setShowAdd} />
    </div>
  )
}
