'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Clock,
  Pencil,
  Trash2,
  Check,
  X,
  RefreshCw,
  MemoryStick,
  Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatBytes, copyToClipboard } from '@/lib/util'

interface KeyHeaderProps {
  connectionKey: string
  keyName: string
  keyType: string
  onRenamed: (newName: string) => void
  onDeleted: () => void
  onRefresh?: () => void
}

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  string:    { bg: 'bg-blue-500/15',   text: 'text-blue-400' },
  hash:      { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  list:      { bg: 'bg-green-500/15',  text: 'text-green-400' },
  set:       { bg: 'bg-cyan-500/15',   text: 'text-cyan-400' },
  zset:      { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  stream:    { bg: 'bg-[#A9C77D]/15',  text: 'text-[#A9C77D]' },
  'ReJSON-RL': { bg: 'bg-pink-500/15', text: 'text-pink-400' },
}

function TypeBadge({ type }: { type: string }) {
  const style = TYPE_STYLES[type] ?? { bg: 'bg-muted', text: 'text-muted-foreground' }
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0 border border-transparent',
        style.bg,
        style.text,
      )}
    >
      {type}
    </span>
  )
}

const GET_COMMAND: Record<string, string> = {
  string: 'GET',
  hash: 'HGETALL',
  list: 'LRANGE ... 0 -1',
  set: 'SMEMBERS',
  zset: 'ZRANGE ... 0 -1 WITHSCORES',
  stream: 'XRANGE ... - +',
  'ReJSON-RL': 'JSON.GET',
}

export function KeyHeader({
  connectionKey,
  keyName,
  keyType,
  onRenamed,
  onDeleted,
  onRefresh,
}: KeyHeaderProps) {
  const [ttl, setTtl] = useState<number | null>(null)
  const [editingTtl, setEditingTtl] = useState(false)
  const [ttlInput, setTtlInput] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(keyName)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null)
  const [savingTtl, setSavingTtl] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchTtl = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/keys/${connectionKey}/ttl?keyName=${encodeURIComponent(keyName)}`,
      )
      if (res.ok) {
        const data = await res.json()
        setTtl(typeof data.ttl === 'number' ? data.ttl : -1)
      }
    } catch { /* ignore */ }
  }, [connectionKey, keyName])

  const fetchMemory = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/keys/${connectionKey}/memory?keyName=${encodeURIComponent(keyName)}`,
      )
      if (res.ok) {
        const data = await res.json()
        if (typeof data.usage === 'number') setMemoryUsage(data.usage)
      }
    } catch { /* ignore */ }
  }, [connectionKey, keyName])

  useEffect(() => {
    fetchTtl()
    fetchMemory()
  }, [fetchTtl, fetchMemory])

  useEffect(() => {
    setNameInput(keyName)
  }, [keyName])

  const handleSaveTtl = useCallback(async () => {
    const parsed = parseInt(ttlInput, 10)
    if (Number.isNaN(parsed)) return
    setSavingTtl(true)
    try {
      const res = await fetch(`/api/keys/${connectionKey}/expire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName, ttl: parsed }),
      })
      if (res.ok) {
        setTtl(parsed)
        setEditingTtl(false)
      }
    } catch { /* ignore */ }
    setSavingTtl(false)
  }, [connectionKey, keyName, ttlInput])

  const handleRename = useCallback(async () => {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === keyName) {
      setEditingName(false)
      return
    }
    setRenaming(true)
    try {
      const res = await fetch(`/api/keys/${connectionKey}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName, newKeyName: trimmed }),
      })
      if (res.ok) {
        setEditingName(false)
        onRenamed(trimmed)
      }
    } catch { /* ignore */ }
    setRenaming(false)
  }, [connectionKey, keyName, nameInput, onRenamed])

  const handleDelete = useCallback(async () => {
    try {
      await fetch(
        `/api/keys/${connectionKey}/delete?keyName=${encodeURIComponent(keyName)}`,
        { method: 'DELETE' },
      )
      onDeleted()
    } catch { /* ignore */ }
  }, [connectionKey, keyName, onDeleted])

  const handleCopyCommand = useCallback(() => {
    const cmd = GET_COMMAND[keyType] ?? 'GET'
    const text = `${cmd.replace('...', `"${keyName}"`)} "${keyName}"`
    copyToClipboard(text)
    setCopied(true)
    toast.success('Command copied to clipboard.')
    setTimeout(() => setCopied(false), 1500)
  }, [keyName, keyType])

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-muted/10 shrink-0 min-w-0 flex-wrap">
      {/* Type badge */}
      <TypeBadge type={keyType} />

      {/* Key name */}
      {editingName ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') { setEditingName(false); setNameInput(keyName) }
            }}
            className="h-6 text-xs font-mono px-2 flex-1"
            autoFocus
          />
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={handleRename} disabled={renaming}>
            <Check className="h-3 w-3 text-green-500" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => { setEditingName(false); setNameInput(keyName) }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          className="flex-1 min-w-0 text-left group/name"
          onClick={() => setEditingName(true)}
          title={keyName}
        >
          <span className="font-mono text-xs text-foreground truncate block hover:text-primary transition-colors">
            {keyName}
          </span>
        </button>
      )}

      {/* Memory */}
      {memoryUsage !== null && (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 border border-border/50 rounded px-1.5 py-0.5">
          <MemoryStick className="h-2.5 w-2.5" />
          {formatBytes(memoryUsage)}
        </span>
      )}

      {/* Separator */}
      <span className="text-border/70 text-xs select-none shrink-0">|</span>

      {/* TTL */}
      <div className="flex items-center gap-1 shrink-0">
        <Clock className="h-3 w-3 text-muted-foreground" />
        {editingTtl ? (
          <div className="flex items-center gap-1">
            <Input
              value={ttlInput}
              onChange={(e) => setTtlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTtl()
                if (e.key === 'Escape') setEditingTtl(false)
              }}
              placeholder="-1 = persist"
              className="h-6 w-24 text-xs font-mono px-2"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveTtl} disabled={savingTtl}>
              <Check className="h-3 w-3 text-green-500" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingTtl(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">
              {ttl === null ? '…' : ttl === -1 ? 'No expiry' : `${ttl}s`}
            </span>
            <button
              onClick={() => { setTtlInput(ttl !== null && ttl !== -1 ? String(ttl) : ''); setEditingTtl(true) }}
              className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              title="Edit TTL"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Separator */}
      <span className="text-border/70 text-xs select-none shrink-0">|</span>

      {/* Refresh */}
      {onRefresh && (
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => { onRefresh(); fetchTtl(); fetchMemory() }}
          title="Refresh value"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}

      {/* Copy as command */}
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={handleCopyCommand}
        title="Copy GET command"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </Button>

      {/* Delete */}
      {confirmDelete ? (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-destructive">Delete?</span>
          <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={handleDelete}>
            Yes
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setConfirmDelete(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
          title="Delete key"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
