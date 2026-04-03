import { useState } from 'react'
import { Minus, Square, X, Cloud, Copy } from 'lucide-react'

export function TitleBar() {
  const [isMax, setIsMax] = useState(false)

  const handleMinimize = () => window.electronAPI?.minimize()
  const handleMaximize = async () => {
    const result = await window.electronAPI?.maximize()
    setIsMax(!!result)
  }
  const handleClose = () => window.electronAPI?.closeWindow()

  return (
    <div
      className="h-9 bg-card border-b flex items-center justify-between select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* 左侧 logo + 标题 */}
      <div className="flex items-center gap-2 pl-3">
        <Cloud className="h-4 w-4 text-orange-500" />
        <span className="text-xs font-semibold text-foreground/80">CF Tunnel Manager</span>
      </div>

      {/* 右侧窗口控制按钮 */}
      <div
        className="flex h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="h-full px-3 hover:bg-accent transition-colors flex items-center"
          aria-label="最小化"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-3 hover:bg-accent transition-colors flex items-center"
          aria-label="最大化"
        >
          {isMax ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </button>
        <button
          onClick={handleClose}
          className="h-full px-3 hover:bg-destructive hover:text-white transition-colors flex items-center"
          aria-label="关闭"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
