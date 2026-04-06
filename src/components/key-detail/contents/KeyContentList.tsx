'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader2, Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface Props {
  connectionKey: string
  keyName: string
}

const ROW_HEIGHT = 36
const DELETED_PLACEHOLDER = '\x00DELETED\x00'

export function KeyContentList({ connectionKey, keyName }: Props) {
  const [items, setItems] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const [newValue, setNewValue] = useState('')
  const [newPosition, setNewPosition] = useState<'before' | 'after'>('after')
  const [adding, setAdding] = useState(false)

  const parentRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/keys/${connectionKey}/get?keyName=${encodeURIComponent(keyName)}&type=list`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(Array.isArray(data.value) ? data.value : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }, [connectionKey, keyName])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const handleSaveEdit = useCallback(async (index: number) => {
    try {
      const res = await fetch(`/api/keys/${connectionKey}/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName, type: 'list', index, value: editDraft }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setItems((prev) => prev.map((v, i) => (i === index ? editDraft : v)))
      setEditingIndex(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [connectionKey, keyName, editDraft])

  const handleDelete = useCallback(async (index: number) => {
    const currentValue = items[index]
    try {
      // LSET to placeholder, then LREM to remove
      await fetch(`/api/redis/${connectionKey}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'LSET', args: [keyName, index, DELETED_PLACEHOLDER] }),
      })
      await fetch(`/api/redis/${connectionKey}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'LREM', args: [keyName, 1, DELETED_PLACEHOLDER] }),
      })
      setItems((prev) => prev.filter((_, i) => i !== index))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [connectionKey, keyName, items])

  const handleAdd = useCallback(async () => {
    if (!newValue.trim() && newValue !== '') {
      // allow empty strings in lists
    }
    setAdding(true)
    try {
      const res = await fetch(`/api/keys/${connectionKey}/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName, type: 'list', position: newPosition, value: newValue }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (newPosition === 'after') {
        setItems((prev) => [...prev, newValue])
      } else {
        setItems((prev) => [newValue, ...prev])
      }
      setNewValue('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setAdding(false)
  }, [connectionKey, keyName, newValue, newPosition])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Loading…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/10 shrink-0">
        <Badge variant="secondary" className="text-xs">{items.length} items</Badge>
        {error && <span className="text-xs text-destructive ml-2">{error}</span>}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[56px_1fr_64px] gap-2 px-3 py-1 border-b border-border bg-muted/20 shrink-0">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">#</span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Value</span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Actions</span>
      </div>

      {/* Virtual rows */}
      <div ref={parentRef} className="flex-1 overflow-auto min-h-0">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const value = items[vItem.index]
            const isEditing = editingIndex === vItem.index

            return (
              <div
                key={vItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${ROW_HEIGHT}px`,
                  transform: `translateY(${vItem.start}px)`,
                }}
                className={`grid grid-cols-[56px_1fr_64px] gap-2 px-3 items-center border-b border-border/50 hover:bg-muted/25 ${vItem.index % 2 === 1 ? 'bg-muted/[0.07]' : ''}`}
              >
                <span className="font-mono text-xs text-muted-foreground">{vItem.index}</span>

                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(vItem.index)
                        if (e.key === 'Escape') setEditingIndex(null)
                      }}
                      className="h-6 text-xs font-mono px-2 flex-1"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(vItem.index)}
                      className="text-green-500 hover:text-green-400"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="font-mono text-xs truncate text-foreground" title={value}>
                    {value}
                  </span>
                )}

                <div className="flex items-center gap-1">
                  {!isEditing && (
                    <button
                      onClick={() => { setEditingIndex(vItem.index); setEditDraft(value) }}
                      className="text-muted-foreground/60 hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(vItem.index)}
                    className="text-muted-foreground/60 hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add footer */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-muted/10 shrink-0">
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setNewPosition('before')}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              newPosition === 'before'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Head
          </button>
          <button
            onClick={() => setNewPosition('after')}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              newPosition === 'after'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Tail
          </button>
        </div>
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="New value"
          className="h-7 text-xs font-mono px-2 flex-1"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <Button
          size="sm"
          className="h-7 px-2 text-xs gap-1 shrink-0"
          onClick={handleAdd}
          disabled={adding}
        >
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add
        </Button>
      </div>
    </div>
  )
}
