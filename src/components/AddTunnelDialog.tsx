import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTunnelStore } from '@/store/tunnelStore'
import { CheckCircle, RefreshCw, Cloud, Key } from 'lucide-react'

interface CfTunnel {
  id: string
  name: string
  status: string
  created_at: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddTunnelDialog({ open, onOpenChange }: Props) {
  const { addTunnel, tunnels } = useTunnelStore()
  const apiToken = useTunnelStore((s) => s.appConfig.cfApiToken) || ''

  // API 模式状态
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([])
  const [cfTunnels, setCfTunnels] = useState<CfTunnel[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState('')
  const [error, setError] = useState('')

  // 手动 Token 模式
  const [manualMode, setManualMode] = useState(false)
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  const [decoded, setDecoded] = useState<{ accountId: string; tunnelId: string } | null>(null)

  const hasApiToken = !!apiToken

  useEffect(() => {
    if (open && hasApiToken) {
      loadAccounts()
    }
  }, [open])

  const reset = () => {
    setName('')
    setToken('')
    setDecoded(null)
    setError('')
    setCfTunnels([])
    setManualMode(false)
  }

  const loadAccounts = async () => {
    setLoading(true)
    setError('')
    const result = await window.electronAPI?.listAccounts(apiToken)
    setLoading(false)
    if (result?.success && result.accounts) {
      setAccounts(result.accounts)
      // 如果只有一个账户，自动选中并加载隧道
      if (result.accounts.length === 1) {
        setSelectedAccount(result.accounts[0].id)
        loadTunnels(result.accounts[0].id)
      }
    } else {
      setError(result?.error || '获取账户失败')
    }
  }

  const loadTunnels = async (accountId: string) => {
    setLoading(true)
    setError('')
    const result = await window.electronAPI?.listTunnels(accountId, apiToken)
    setLoading(false)
    if (result?.success && result.tunnels) {
      setCfTunnels(result.tunnels)
    } else {
      setError(result?.error || '获取隧道失败')
    }
  }

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccount(accountId)
    loadTunnels(accountId)
  }

  const handleSelectTunnel = async (cfTunnel: CfTunnel) => {
    // 检查是否已添加
    if (tunnels.some((t) => t.tunnelId === cfTunnel.id)) {
      setError('该隧道已添加')
      return
    }

    setLoading(true)
    setError('')
    // 获取隧道 token
    const result = await window.electronAPI?.getTunnelToken(selectedAccount, cfTunnel.id, apiToken)
    setLoading(false)

    if (result?.success && result.token) {
      const decoded = await window.electronAPI?.decodeToken(result.token)
      addTunnel({
        id: crypto.randomUUID(),
        name: cfTunnel.name,
        mode: 'token',
        token: result.token,
        accountId: decoded?.accountId || selectedAccount,
        tunnelId: cfTunnel.id,
      })
      onOpenChange(false)
      reset()
    } else {
      setError(result?.error || '获取 Token 失败')
    }
  }

  // 手动 Token 输入
  const handleTokenChange = async (value: string) => {
    let cleanToken = value.trim()
    const match = cleanToken.match(/(?:--token\s+|service\s+install\s+)(\S+)/i)
    if (match) cleanToken = match[1]
    setToken(cleanToken)
    setError('')
    setDecoded(null)

    if (cleanToken.length > 20) {
      const result = await window.electronAPI?.decodeToken(cleanToken)
      if (result) {
        setDecoded(result)
        if (!name) setName(`Tunnel-${result.tunnelId.slice(0, 8)}`)
      } else {
        setError('Token 格式无效')
      }
    }
  }

  const handleManualSubmit = () => {
    if (!name || !token || !decoded) return
    addTunnel({
      id: crypto.randomUUID(),
      name,
      mode: 'token',
      token,
      accountId: decoded.accountId,
      tunnelId: decoded.tunnelId,
    })
    onOpenChange(false)
    reset()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { onOpenChange(false); reset() }}>
      <Card className="w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>添加隧道</CardTitle>
          <CardDescription>
            {hasApiToken && !manualMode
              ? '从你的 Cloudflare 账户中选择一个隧道'
              : '粘贴 Token 或安装命令'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* API 模式 — 选择隧道 */}
          {hasApiToken && !manualMode && (
            <>
              {/* 账户选择（多账户时显示） */}
              {accounts.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">选择账户</label>
                  <div className="space-y-1">
                    {accounts.map((acc) => (
                      <button
                        key={acc.id}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          selectedAccount === acc.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                        }`}
                        onClick={() => handleSelectAccount(acc.id)}
                      >
                        {acc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 隧道列表 */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
                </div>
              ) : cfTunnels.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">选择隧道</label>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {cfTunnels.map((t) => {
                      const alreadyAdded = tunnels.some((existing) => existing.tunnelId === t.id)
                      return (
                        <button
                          key={t.id}
                          disabled={alreadyAdded}
                          className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors border ${
                            alreadyAdded
                              ? 'opacity-50 cursor-not-allowed bg-muted'
                              : 'hover:bg-accent hover:border-accent-foreground/20'
                          }`}
                          onClick={() => handleSelectTunnel(t)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Cloud className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{t.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {alreadyAdded && (
                                <Badge variant="secondary" className="text-xs">已添加</Badge>
                              )}
                              <Badge variant={t.status === 'healthy' ? 'success' : 'secondary'} className="text-xs">
                                {t.status === 'healthy' ? '在线' : t.status === 'inactive' ? '离线' : t.status}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono mt-1">{t.id}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : selectedAccount && !loading ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  该账户下没有隧道，请先在 Cloudflare Dashboard 中创建
                </p>
              ) : null}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">或者</span>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => setManualMode(true)}>
                <Key className="mr-2 h-4 w-4" />
                手动输入 Token
              </Button>
            </>
          )}

          {/* 手动 Token 模式 */}
          {(!hasApiToken || manualMode) && (
            <>
              {manualMode && (
                <Button variant="ghost" size="sm" onClick={() => setManualMode(false)}>
                  ← 返回选择隧道
                </Button>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">隧道名称</label>
                <Input placeholder="例如：我的网站" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Token</label>
                <Textarea
                  placeholder="直接粘贴 Token 或完整安装命令&#10;例如: cloudflared.exe service install eyJhIjo..."
                  rows={3}
                  className="font-mono text-xs"
                  value={token}
                  onChange={(e) => handleTokenChange(e.target.value)}
                />
                {decoded && (
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="success" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Token 有效
                    </Badge>
                    <span className="text-muted-foreground">Tunnel: {decoded.tunnelId.slice(0, 8)}...</span>
                  </div>
                )}
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>

              {!hasApiToken && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  💡 在设置中配置 API Token 后，可以直接从列表选择隧道，不用手动粘贴
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { onOpenChange(false); reset() }}>取消</Button>
                <Button onClick={handleManualSubmit} disabled={!name || !decoded}>创建</Button>
              </div>
            </>
          )}

          {/* API 模式的关闭按钮 */}
          {hasApiToken && !manualMode && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => { onOpenChange(false); reset() }}>关闭</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
