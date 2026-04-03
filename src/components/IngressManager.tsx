import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Plus, X, Save, RefreshCw } from 'lucide-react'
import type { TunnelConfig, TunnelIngress } from '@/types/tunnel'
import { useTunnelStore } from '@/store/tunnelStore'

interface Zone { id: string; name: string }
interface IngressRow { subdomain: string; zone: string; service: string }

function parseHostname(hostname: string, zones: Zone[]): { subdomain: string; zone: string } {
  for (const z of zones) {
    if (hostname === z.name) return { subdomain: '', zone: z.name }
    if (hostname.endsWith('.' + z.name)) return { subdomain: hostname.slice(0, -(z.name.length + 1)), zone: z.name }
  }
  const parts = hostname.split('.')
  if (parts.length >= 2) return { subdomain: parts.slice(0, -2).join('.'), zone: parts.slice(-2).join('.') }
  return { subdomain: '', zone: hostname }
}

function buildHostname(row: IngressRow): string {
  const sub = row.subdomain.trim()
  return sub ? `${sub}.${row.zone}` : row.zone
}

interface Props { tunnel: TunnelConfig; open: boolean; onOpenChange: (v: boolean) => void }

export function IngressManager({ tunnel, open, onOpenChange }: Props) {
  const { updateTunnel, stopTunnel, startTunnel, statuses } = useTunnelStore()
  const [rows, setRows] = useState<IngressRow[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('初始化...')
  const isRunning = statuses[tunnel.id]?.status === 'running'
  const apiToken = useTunnelStore((s) => s.appConfig.cfApiToken) || ''

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      setInfo('开始加载...')

      // 解析 IDs
      let accountId = tunnel.accountId || ''
      let tunnelId = tunnel.tunnelId || ''

      if ((!accountId || !tunnelId) && tunnel.token) {
        try {
          const d = await window.electronAPI?.decodeToken(tunnel.token)
          if (d) { accountId = d.accountId; tunnelId = d.tunnelId }
        } catch (e) {
          setInfo(`decodeToken 异常: ${e}`)
        }
      }

      if (accountId && tunnelId) {
        updateTunnel(tunnel.id, { accountId, tunnelId })
      }

      setInfo(`accountId=${accountId || 'empty'}, tunnelId=${tunnelId || 'empty'}, apiToken=${apiToken ? 'yes(' + apiToken.slice(0, 6) + '...)' : 'no'}`)

      // 加载域名
      let zs: Zone[] = []
      if (apiToken) {
        try {
          const zr = await window.electronAPI?.listZones(apiToken)
          if (zr?.success && zr.zones) { zs = zr.zones.filter(z => z.status === 'active'); setZones(zs) }
          setInfo(prev => prev + `, zones=${zs.length}`)
        } catch (e) {
          setInfo(prev => prev + `, zones error: ${e}`)
        }
      }

      // 加载远端 ingress
      if (apiToken && accountId && tunnelId) {
        try {
          const r = await window.electronAPI?.getIngress(accountId, tunnelId, apiToken)
          setInfo(prev => prev + `\n远端原始: ${JSON.stringify(r, null, 2).slice(0, 1500)}`)
          if (r?.success && r.ingress) {
            const rules = (r.ingress as any[]).filter(x => x.hostname)
            if (rules.length > 0) {
              setRows(rules.map(x => { const p = parseHostname(x.hostname, zs); return { subdomain: p.subdomain, zone: p.zone, service: x.service } }))
              setLoading(false)
              return
            }
          }
        } catch (e) {
          setInfo(prev => prev + `\ningress error: ${e}`)
        }
      }

      // fallback 本地
      const existing = (tunnel.ingress || []).filter(r => r.hostname)
      if (existing.length > 0) {
        setRows(existing.map(r => { const p = parseHostname(r.hostname, zs); return { subdomain: p.subdomain, zone: p.zone, service: r.service } }))
      } else {
        setRows([{ subdomain: '', zone: zs[0]?.name || '', service: '' }])
      }
    } catch (e) {
      setInfo(`loadAll 异常: ${e}`)
      setError(`加载失败: ${e}`)
    } finally {
      setLoading(false)
    }
  }, [tunnel.id, tunnel.token, tunnel.accountId, tunnel.tunnelId, apiToken])

  useEffect(() => {
    if (open) loadAll()
  }, [open, loadAll])

  const addRow = () => { setRows([...rows, { subdomain: '', zone: zones[0]?.name || '', service: '' }]); setSaveSuccess(false) }
  const updateRow = (i: number, f: keyof IngressRow, v: string) => { const u = [...rows]; u[i] = { ...u[i], [f]: v }; setRows(u); setSaveSuccess(false) }
  const removeRow = (i: number) => { setRows(rows.filter((_, j) => j !== i)); setSaveSuccess(false) }

  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleSave = async () => {
    setSaving(true); setError(''); setSaveSuccess(false)
    const valid = rows.filter(r => r.zone && r.service).map(r => ({ hostname: buildHostname(r), service: r.service.trim().replace(/\/+$/, '') }))
    if (!valid.length) { setError('至少需要一条规则'); setSaving(false); return }

    let accountId = tunnel.accountId || ''
    let tunnelId = tunnel.tunnelId || ''
    if ((!accountId || !tunnelId) && tunnel.token) {
      const d = await window.electronAPI?.decodeToken(tunnel.token)
      if (d) { accountId = d.accountId; tunnelId = d.tunnelId }
    }

    if (!apiToken || !accountId || !tunnelId) {
      setError(`缺少信息: apiToken=${!!apiToken}, accountId=${accountId || 'empty'}, tunnelId=${tunnelId || 'empty'}`)
      setSaving(false); return
    }

    // 全量推送 ingress（包含所有当前规则 + catch-all）
    const ingress = [...valid.map(r => ({ hostname: r.hostname, service: r.service, originRequest: {} })), { service: 'http_status:404' }]
    const result = await window.electronAPI?.updateIngress(accountId, tunnelId, apiToken, ingress)
    if (!result?.success) { setError(`推送路由失败: ${result?.error}`); setSaving(false); return }

    setInfo(prev => prev + '\n✅ 路由已推送到 Cloudflare')

    // DNS 管理
    const newHostnames = valid.map(r => r.hostname)
    const oldHostnames = (tunnel.ingress || []).filter(r => r.hostname).map(r => r.hostname)
    const removedHostnames = oldHostnames.filter(h => !newHostnames.includes(h))

    if (zones.length > 0) {
      const dnsResult = await window.electronAPI?.ensureDns(tunnelId, newHostnames, removedHostnames, apiToken, zones)
      if (dnsResult?.created?.length) setInfo(prev => prev + `\n✅ DNS 已创建: ${dnsResult.created.join(', ')}`)
      if (dnsResult?.removed?.length) setInfo(prev => prev + `\n🗑 DNS 已删除: ${dnsResult.removed.join(', ')}`)
      if (dnsResult?.errors?.length) setInfo(prev => prev + `\n⚠️ DNS 问题: ${dnsResult.errors.join('; ')}`)
    }

    // 保存本地
    updateTunnel(tunnel.id, {
      accountId, tunnelId,
      ingress: [...valid.map(r => ({ hostname: r.hostname, service: r.service } as TunnelIngress)), { hostname: '', service: 'http_status:404' }],
    })

    // 保存后始终（重新）启动隧道
    setInfo(prev => prev + '\n正在启动隧道...')
    const currentStatus = useTunnelStore.getState().statuses[tunnel.id]
    if (currentStatus?.status === 'running') {
      await stopTunnel(tunnel.id)
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 500))
        const s = useTunnelStore.getState().statuses[tunnel.id]
        if (!s || s.status !== 'running') break
      }
    }
    // 等 store 持久化完成
    await new Promise(r => setTimeout(r, 300))
    await startTunnel(tunnel.id)
    setInfo(prev => prev + '\n✅ 隧道已启动')
    setSaving(false)
    setSaveSuccess(true)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => onOpenChange(false)}>
      <Card className="w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>端口映射 - {tunnel.name}</CardTitle>
          <CardDescription>配置子域名到本地服务的映射，保存后推送到 Cloudflare</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <details className="text-[10px] text-muted-foreground bg-muted rounded border">
            <summary className="px-2 py-1.5 cursor-pointer hover:bg-muted/80 select-none">日志信息</summary>
            <pre className="px-2 pb-2 whitespace-pre-wrap break-all">{info}</pre>
          </details>

          {loading ? (
            <div className="flex items-center justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /><span className="ml-2 text-sm text-muted-foreground">加载中...</span></div>
          ) : (<>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">映射规则</span>
              <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-3 w-3 mr-1" /> 添加</Button>
            </div>
            {rows.length > 0 && <div className="grid grid-cols-[1fr_auto_1fr_1fr_auto] gap-2 text-xs text-muted-foreground px-1"><span>子域名</span><span /><span>主域名</span><span>本地服务</span><span className="w-8" /></div>}
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr_1fr_auto] gap-2 items-center">
                  <Input placeholder="app" value={row.subdomain} onChange={e => updateRow(i, 'subdomain', e.target.value)} className="text-sm" />
                  <span className="text-muted-foreground text-sm">.</span>
                  {zones.length > 0 ? (
                    <select value={row.zone} onChange={e => updateRow(i, 'zone', e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">选择域名</option>
                      {zones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
                    </select>
                  ) : <Input placeholder="example.com" value={row.zone} onChange={e => updateRow(i, 'zone', e.target.value)} className="text-sm" />}
                  <Input placeholder="http://localhost:3000" value={row.service} onChange={e => updateRow(i, 'service', e.target.value)} className="text-sm font-mono" />
                  <Button size="icon" variant="ghost" onClick={() => removeRow(i)} className="h-8 w-8"><X className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
            {rows.some(r => r.zone && r.service) && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                <p className="font-medium">预览：</p>
                {rows.filter(r => r.zone && r.service).map((r, i) => <p key={i} className="font-mono pl-2">{buildHostname(r)} → {r.service.trim().replace(/\/+$/, '')}</p>)}
              </div>
            )}
          </>)}
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded p-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {saveSuccess ? '完成' : '取消'}
            </Button>
            <Button onClick={handleSave} disabled={saving || loading || saveSuccess}>
              <Save className="mr-2 h-4 w-4" />{saving ? '保存中...' : saveSuccess ? '已保存' : '保存并启动'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
