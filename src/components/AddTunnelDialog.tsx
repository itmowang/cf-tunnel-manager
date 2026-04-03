import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTunnelStore } from '@/store/tunnelStore'
import { RefreshCw, Cloud, Plus } from 'lucide-react'

interface CfTunnel { id: string; name: string; status: string }
interface Props { open: boolean; onOpenChange: (v: boolean) => void }

export function AddTunnelDialog({ open, onOpenChange }: Props) {
  const { addTunnel, tunnels } = useTunnelStore()
  const apiToken = useTunnelStore((s) => s.appConfig.cfApiToken) || ''

  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([])
  const [cfTunnels, setCfTunnels] = useState<CfTunnel[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState('')
  const [error, setError] = useState('')

  // 创建隧道
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (open && apiToken) loadAccounts()
  }, [open])

  const reset = () => { setError(''); setShowCreate(false); setNewName('') }

  const loadAccounts = async () => {
    setLoading(true); setError('')
    const r = await window.electronAPI?.listAccounts(apiToken)
    setLoading(false)
    if (r?.success && r.accounts) {
      setAccounts(r.accounts)
      if (r.accounts.length === 1) {
        setSelectedAccount(r.accounts[0].id)
        loadTunnels(r.accounts[0].id)
      }
    } else {
      setError(r?.error || '获取账户失败')
    }
  }

  const loadTunnels = async (accountId: string) => {
    setLoading(true); setError('')
    const r = await window.electronAPI?.listTunnels(accountId, apiToken)
    setLoading(false)
    if (r?.success && r.tunnels) setCfTunnels(r.tunnels)
    else setError(r?.error || '获取隧道失败')
  }

  const handleSelectAccount = (id: string) => { setSelectedAccount(id); loadTunnels(id) }

  const handleSelectTunnel = async (cfTunnel: CfTunnel) => {
    if (tunnels.some(t => t.tunnelId === cfTunnel.id)) { setError('该隧道已添加'); return }
    setLoading(true); setError('')
    const tokenResult = await window.electronAPI?.getTunnelToken(selectedAccount, cfTunnel.id, apiToken)
    setLoading(false)

    let token: string | undefined
    let accountId = selectedAccount
    if (tokenResult?.success && tokenResult.token) {
      token = tokenResult.token
      const decoded = await window.electronAPI?.decodeToken(tokenResult.token)
      if (decoded) accountId = decoded.accountId
    }

    addTunnel({
      id: crypto.randomUUID(),
      name: cfTunnel.name,
      mode: 'token',
      token,
      accountId,
      tunnelId: cfTunnel.id,
    })
    onOpenChange(false); reset()
  }

  const handleCreate = async () => {
    if (!newName.trim() || !selectedAccount) return
    setCreating(true); setError('')
    const r = await window.electronAPI?.createTunnel(selectedAccount, newName.trim(), apiToken)
    setCreating(false)
    if (r?.success && r.tunnel) {
      // 创建成功，获取 token 并添加
      const tokenResult = await window.electronAPI?.getTunnelToken(selectedAccount, r.tunnel.id, apiToken)
      let token: string | undefined
      if (tokenResult?.success) token = tokenResult.token

      addTunnel({
        id: crypto.randomUUID(),
        name: r.tunnel.name,
        mode: 'token',
        token,
        accountId: selectedAccount,
        tunnelId: r.tunnel.id,
      })
      onOpenChange(false); reset()
    } else {
      setError(r?.error || '创建隧道失败')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { onOpenChange(false); reset() }}>
      <Card className="w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>添加隧道</CardTitle>
          <CardDescription>
            {apiToken ? '从 Cloudflare 选择或创建新隧道' : '请先在设置中配置 API Token'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!apiToken ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              请先在设置页面配置 Cloudflare API Token
            </p>
          ) : (
            <>
              {/* 账户选择 */}
              {accounts.length > 1 && (
                <div className="space-y-1">
                  {accounts.map(acc => (
                    <button key={acc.id}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedAccount === acc.id ? 'bg-accent' : 'hover:bg-accent/50'}`}
                      onClick={() => handleSelectAccount(acc.id)}
                    >{acc.name}</button>
                  ))}
                </div>
              )}

              {/* 隧道列表 */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
                </div>
              ) : cfTunnels.length > 0 ? (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {cfTunnels.map(t => {
                    const added = tunnels.some(x => x.tunnelId === t.id)
                    return (
                      <button key={t.id} disabled={added}
                        className={`w-full text-left px-3 py-2.5 rounded-md text-sm border transition-colors ${added ? 'opacity-50 cursor-not-allowed bg-muted' : 'hover:bg-accent hover:border-accent-foreground/20'}`}
                        onClick={() => handleSelectTunnel(t)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Cloud className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{t.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {added && <Badge variant="secondary" className="text-xs">已添加</Badge>}
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
              ) : selectedAccount && !loading ? (
                <p className="text-sm text-muted-foreground text-center py-4">该账户下没有隧道</p>
              ) : null}

              {/* 创建新隧道 */}
              {selectedAccount && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">或者</span>
                    </div>
                  </div>

                  {showCreate ? (
                    <div className="space-y-3 p-3 rounded-md border bg-muted/30">
                      <p className="text-sm font-medium">创建新隧道</p>
                      <Input placeholder="隧道名称" value={newName} onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
                          {creating ? <><RefreshCw className="mr-1 h-3 w-3 animate-spin" /> 创建中...</> : '创建并添加'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={() => setShowCreate(true)}>
                      <Plus className="mr-2 h-4 w-4" /> 创建新隧道
                    </Button>
                  )}
                </>
              )}
            </>
          )}

          {error && <p className="text-sm text-destructive bg-destructive/10 rounded p-2">{error}</p>}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => { onOpenChange(false); reset() }}>关闭</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
