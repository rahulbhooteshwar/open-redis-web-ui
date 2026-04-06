'use client'

import { FileWarning } from 'lucide-react'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function ViewerOverSize({ size }: { size: number }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4 p-8 text-center">
      <FileWarning className="w-10 h-10 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          Value too large to display inline
        </p>
        <p className="text-xs text-muted-foreground">
          Size: {formatBytes(size)}
        </p>
      </div>
      <p className="text-xs text-muted-foreground max-w-xs">
        Use the Redis CLI to retrieve this value:
      </p>
      <code className="text-xs bg-muted px-3 py-1.5 rounded font-mono border border-border">
        GET keyname
      </code>
    </div>
  )
}
