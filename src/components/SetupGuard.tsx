import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Cloud, Download, CheckCircle, FolderOpen, RefreshCw } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

export function SetupGuard({ children }: Props) {
  const [status, setStatus] = useState<'checking' | 'ready' | 'missing'>('checking')
  const [version, setVersion] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState<{ percent: number; status: string } | null>(null)
  const [customPath, setCustomPath] = useState('')
  const [error, setError] = useState('')

  const check = async () => {
    setStatus('checking')
    setError('')
    const result = await window.electronAPI?.checkCloudflared()
    if (result?.available) {
      setVersion(result.version || '')
      setStatus('ready')
    } else {
      setStatus('missing')
    }
  }

  useEffect(() => {
    check()
    const cleanup = window.electronAPI?.onDownloadProgress((data: { percent: number; status: string }) => {
      setProgress(data)
    })
    return () => cleanup?.()
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    setError('')
    setProgress({ percent: 0, status: '准备下载...' })
    const result = await window.electronAPI?.downloadCloudflared()
    setDownloading(false)
    if (result?.success) {
      setProgress(null)
      check()
    } else {
      setError(result?.error || '下载失败')
      setProgress(null)
    }
  }

  const applyPath = async (p: string) => {
    // 通过 store:save 合并保存，不会覆盖已有数据
    const data = await window.electronAPI?.loadData()
    await window.electronAPI?.saveData({
      ...data,
      appConfig: { ...(data?.appConfig || {}), cloudflaredPath: p },
    })
    setTimeout(check, 300)
  }

  const handleBrowse = async () => {
    const p = await window.electronAPI?.selectExecutable()
    if (p) {
      setCustomPath(p)
      applyPath(p)
    }
  }

  const handleManualPath = async () => {
    if (!customPath.trim()) return
    applyPath(customPath.trim())
  }

  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">正在检测环境...</p>
        </div>
      </div>
    )
  }

  if (status === 'ready') {
    return <>{children}</>
  }

  // missing 状态 — 引导安装
  return (
    <div className="flex items-center justify-center flex-1 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Cloud className="h-12 w-12 text-orange-500" />
          </div>
          <CardTitle className="text-2xl">CF Tunnel Manager</CardTitle>
          <CardDescription>
            需要先安装 cloudflared 才能使用
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 一键下载 */}
          <Button className="w-full" size="lg" onClick={handleDownload} disabled={downloading}>
            <Download className="mr-2 h-4 w-4" />
            {downloading ? '下载中...' : '一键下载 cloudflared'}
          </Button>

          {progress && (
            <div className="space-y-1">
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">{progress.status}</p>
            </div>
          )}

          {error && <p className="text-xs text-destructive text-center">{error}</p>}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">或者</span>
            </div>
          </div>

          {/* 手动选择 */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">已经安装了？指定路径：</p>
            <div className="flex gap-2">
              <Input
                placeholder="cloudflared.exe 路径"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualPath()}
              />
              <Button variant="outline" onClick={handleBrowse}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            {customPath && (
              <Button variant="outline" className="w-full" onClick={handleManualPath}>
                <CheckCircle className="mr-2 h-4 w-4" />
                使用此路径
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
