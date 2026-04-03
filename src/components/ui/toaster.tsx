import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
}

interface ToastContextType {
  toast: (t: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

// 简单的全局 toast 函数
let globalToast: (t: Omit<Toast, 'id'>) => void = () => {}

export function toast(t: Omit<Toast, 'id'>) {
  globalToast(t)
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { ...t, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 4000)
  }, [])

  useEffect(() => {
    globalToast = addToast
  }, [addToast])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'rounded-lg border p-4 shadow-lg transition-all animate-in slide-in-from-bottom-2',
            t.variant === 'destructive'
              ? 'border-destructive bg-destructive text-destructive-foreground'
              : t.variant === 'success'
              ? 'border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100'
              : 'border-border bg-card text-card-foreground'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{t.title}</p>
              {t.description && (
                <p className="text-xs mt-1 opacity-80">{t.description}</p>
              )}
            </div>
            <button onClick={() => removeToast(t.id)} className="opacity-50 hover:opacity-100">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
