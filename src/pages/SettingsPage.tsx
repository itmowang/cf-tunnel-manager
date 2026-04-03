import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTunnelStore } from '@/store/tunnelStore'
import { CheckCircle, XCircle, RefreshCw, Download, Eye, EyeOff, ArrowUpCircle } from 'lucide-react'

export default function SettingsPage() {
  const { appConfig, setAppConfig } = useTunnelStore()
  const [cfStatus, setCfStatus] = useState<{ available: boolean; version?: string; error?: string } | null>(null)
  const [checking, setChecking] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number; status: string } | null>(null)

  // API Token
  const [apiToken, setApiToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')

  // 自动更新
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<any>(null)
  const [tokenError, setTokenError] = useState('')

  const checkCf = async () => {
    setChecking(true)
    const result = await window.electronAPI?.checkCloudflared()
    setCfStatus(result || { available: false, error: '无法检测' })
    setChecking(false)
  }

  useEffect(() => {
    checkCf()
    if (appConfig.cfApiToken) {
      setApiToken(appConfig.cfApiToken)
      setTokenStatus('valid')
    }
    // 获取版本号
    window.electronAPI?.getAppVersion().then(v => setAppVersion(v || '0.1.0'))
    // 监听更新状态
    const cleanup = window.electronAPI?.onUpdateStatus((data: any) => setUpdateStatus(data))
    const cleanup2 = window.electronAPI?.onDownloadProgress((data: { percent: number; status: string }) => {
      setDownloadProgress(data)
    })
    return () => { cleanup?.(); cleanup2?.() }
  }, [])

  const handleBrowse = async () => {
    const p = await window.electronAPI?.selectExecutable()
    if (p) {
      setAppConfig({ cloudflaredPath: p })
      setTimeout(checkCf, 300)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    setDownloadProgress({ percent: 0, status: '准备下载...' })
    const result = await window.electronAPI?.downloadCloudflared()
    setDownloading(false)
    if (result?.success && result.path) {
      setAppConfig({ cloudflaredPath: result.path })
      setDownloadProgress(null)
      setTimeout(checkCf, 500)
    } else {
      setDownloadProgress({ percent: 0, status: result?.error || '下载失败' })
    }
  }

  const handleVerifyToken = async () => {
    if (!apiToken.trim()) return
    setVerifying(true)
    setTokenError('')
    const result = await window.electronAPI?.verifyToken(apiToken.trim())
    setVerifying(false)
    if (result?.success) {
      setTokenStatus('valid')
      setAppConfig({ cfApiToken: apiToken.trim() })
    } else {
      setTokenStatus('invalid')
      setTokenError(result?.error || '验证失败')
    }
  }

  const handleClearToken = () => {
    setApiToken('')
    setTokenStatus('idle')
    setAppConfig({ cfApiToken: '' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">设置</h1>
        <p className="text-muted-foreground">配置应用程序参数</p>
      </div>

      {/* Cloudflare API Token */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cloudflare API Token</CardTitle>
              <CardDescription>用于获取域名列表和管理 DNS，在端口映射时可以直接选择域名</CardDescription>
            </div>
            {tokenStatus === 'valid' && (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> 已验证
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showToken ? 'text' : 'password'}
                placeholder="Cloudflare API Token"
                value={apiToken}
                onChange={(e) => { setApiToken(e.target.value); setTokenStatus('idle') }}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button onClick={handleVerifyToken} disabled={verifying || !apiToken.trim()}>
              {verifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : '验证'}
            </Button>
            {tokenStatus === 'valid' && (
              <Button variant="outline" onClick={handleClearToken}>清除</Button>
            )}
          </div>
          {tokenStatus === 'invalid' && tokenError && (
            <p className="text-xs text-destructive">{tokenError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            去 dash.cloudflare.com/profile/api-tokens 创建，权限需要：Zone:Read + Cloudflare Tunnel:Edit
          </p>
        </CardContent>
      </Card>

      {/* cloudflared */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>cloudflared</CardTitle>
              <CardDescription>Cloudflare Tunnel 客户端程序</CardDescription>
            </div>
            {cfStatus && (
              <Badge variant={cfStatus.available ? 'success' : 'destructive'} className="flex items-center gap-1">
                {cfStatus.available ? <><CheckCircle className="h-3 w-3" /> 可用</> : <><XCircle className="h-3 w-3" /> 不可用</>}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={appConfig.cloudflaredPath}
              onChange={(e) => setAppConfig({ cloudflaredPath: e.target.value })}
              placeholder="cloudflared"
            />
            <Button variant="outline" onClick={handleBrowse}>浏览</Button>
            <Button variant="outline" size="icon" onClick={checkCf} disabled={checking}>
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {cfStatus?.available && cfStatus.version && (
            <p className="text-xs text-muted-foreground">版本: {cfStatus.version}</p>
          )}
          {cfStatus && !cfStatus.available && (
            <div className="space-y-3">
              <p className="text-xs text-destructive">{cfStatus.error}</p>
              <Button onClick={handleDownload} disabled={downloading}>
                <Download className="mr-2 h-4 w-4" />
                {downloading ? '下载中...' : '一键下载 cloudflared'}
              </Button>
              {downloadProgress && (
                <div className="space-y-1">
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${Math.max(0, downloadProgress.percent)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{downloadProgress.status}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 行为设置 */}
      <Card>
        <CardHeader>
          <CardTitle>行为设置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={appConfig.minimizeToTray} onChange={(e) => setAppConfig({ minimizeToTray: e.target.checked })} className="rounded" />
            <span className="text-sm">关闭时最小化到系统托盘</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={appConfig.autoStart} onChange={(e) => setAppConfig({ autoStart: e.target.checked })} className="rounded" />
            <span className="text-sm">开机自启动</span>
          </label>
        </CardContent>
      </Card>

      {/* 关于与更新 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>关于</CardTitle>
              <CardDescription>CF Tunnel Manager v{appVersion}</CardDescription>
            </div>
            {updateStatus?.status === 'available' && (
              <Badge variant="default" className="flex items-center gap-1">
                <ArrowUpCircle className="h-3 w-3" /> 有新版本
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(!updateStatus || updateStatus.status === 'up-to-date') && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">已是最新版本</span>
              <Button size="sm" variant="ghost" onClick={() => window.electronAPI?.checkUpdate()}>
                <RefreshCw className="h-3 w-3 mr-1" /> 检查更新
              </Button>
            </div>
          )}
          {updateStatus?.status === 'checking' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" /> 正在检查更新...
            </div>
          )}
          {updateStatus?.status === 'available' && (
            <div className="space-y-2">
              <p className="text-sm">发现新版本: v{updateStatus.version}</p>
              <Button onClick={() => window.electronAPI?.downloadUpdate()}>
                <Download className="mr-2 h-4 w-4" /> 下载更新
              </Button>
            </div>
          )}
          {updateStatus?.status === 'downloading' && (
            <div className="space-y-2">
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${updateStatus.percent}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">下载中 {updateStatus.percent}%</p>
            </div>
          )}
          {updateStatus?.status === 'downloaded' && (
            <div className="space-y-2">
              <p className="text-sm">v{updateStatus.version} 已下载完成</p>
              <Button onClick={() => window.electronAPI?.installUpdate()}>
                立即重启并安装
              </Button>
            </div>
          )}
          {updateStatus?.status === 'error' && (
            <div className="space-y-2">
              <p className="text-xs text-destructive">{updateStatus.error}</p>
              <Button size="sm" variant="outline" onClick={() => window.electronAPI?.checkUpdate()}>
                重试
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
