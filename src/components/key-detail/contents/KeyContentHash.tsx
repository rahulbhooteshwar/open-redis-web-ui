'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader2, Pencil, Trash2, Plus, Copy, Code2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { FormatViewer } from '@/components/viewers/FormatViewer'

interface Props {
  connectionKey: string
  keyName: string
}

interface HashEntry {
  field: string
  value: string
}

const ROW_HEIGHT = 40

export function KeyContentHash({ connectionKey, keyName }: Props) {
  const [entries, setEntries] = useState<HashEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Shared field/value dialog (used for both edit and view modes)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogReadOnly, setDialogReadOnly] = useState(false)
  const [editOriginalField, setEditOriginalField] = useState('')
  const [editField, setEditField] = useState('')
  const [editValueBytes, setEditValueBytes] = useState<Uint8Array>(new Uint8Array())
  const [editSaving, setEditSaving] = useState(false)

  // Add dialog
  const [addOpen, setAddOpen] = useState(false)
  const [newField, setNewField] = useState('')
  const [newValueBytes, setNewValueBytes] = useState<Uint8Array>(new Uint8Array())
  const [adding, setAdding] = useState(false)

  const parentRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/keys/${connectionKey}/get?keyName=${encodeURIComponent(keyName)}&type=hash`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // Server returns [[field, value], ...] pairs (hgetall transformer in redisService)
      const pairs: [string, string][] = Array.isArray(data.value) ? data.value : []
      setEntries(pairs.map(([field, value]) => ({ field, value })))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }, [connectionKey, keyName])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entries
    const q = search.toLowerCase()
    return entries.filter(
      (e) => e.field.toLowerCase().includes(q) || e.value.toLowerCase().includes(q),
    )
  }, [entries, search])

  const virtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const openEditDialog = useCallback((entry: HashEntry) => {
    setDialogReadOnly(false)
    setEditOriginalField(entry.field)
    setEditField(entry.field)
    setEditValueBytes(new TextEncoder().encode(entry.value))
    setDialogOpen(true)
  }, [])

  const openViewDialog = useCallback((entry: HashEntry) => {
    setDialogReadOnly(true)
    setEditOriginalField(entry.field)
    setEditField(entry.field)
    setEditValueBytes(new TextEncoder().encode(entry.value))
    setDialogOpen(true)
  }, [])

  const handleCopyValue = useCallback((value: string) => {
    navigator.clipboard.writeText(value).then(()=>{
      toast.success('Value copied to clipboard.')
    }).catch(() => {})
  }, [])

  const handleSaveEdit = useCallback(async () => {
    setEditSaving(true)
    try {
      const value = new TextDecoder('utf-8').decode(editValueBytes)
      // Use HSET directly — the /set route deletes the whole hash, unsuitable for single-field edits
      const res = await fetch(`/api/redis/${connectionKey}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'HSET', args: [keyName, editField, value] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (editField !== editOriginalField) {
        await fetch(`/api/redis/${connectionKey}/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'HDEL', args: [keyName, editOriginalField] }),
        })
      }
      setEntries((prev) => {
        if (editField !== editOriginalField) {
          return prev
            .filter((e) => e.field !== editOriginalField)
            .concat({ field: editField, value })
        }
        return prev.map((e) => (e.field === editOriginalField ? { ...e, value } : e))
      })
      setDialogOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setEditSaving(false)
  }, [connectionKey, keyName, editField, editOriginalField, editValueBytes])

  const handleDeleteField = useCallback(async (field: string) => {
    try {
      const res = await fetch(`/api/redis/${connectionKey}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'HDEL', args: [keyName, field] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setEntries((prev) => prev.filter((e) => e.field !== field))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [connectionKey, keyName])

  const openAddDialog = useCallback(() => {
    setNewField('')
    setNewValueBytes(new Uint8Array())
    setAddOpen(true)
  }, [])

  const handleAddField = useCallback(async () => {
    const trimField = newField.trim()
    if (!trimField) return
    setAdding(true)
    try {
      const value = new TextDecoder('utf-8').decode(newValueBytes)
      const res = await fetch(`/api/redis/${connectionKey}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'HSET', args: [keyName, trimField, value] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setEntries((prev) => {
        const existing = prev.findIndex((e) => e.field === trimField)
        if (existing >= 0) {
          return prev.map((e) => (e.field === trimField ? { ...e, value } : e))
        }
        return [...prev, { field: trimField, value }]
      })
      setAddOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setAdding(false)
  }, [connectionKey, keyName, newField, newValueBytes])

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
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-muted/10 shrink-0">
        {error && <span className="text-xs text-destructive">{error}</span>}
        <Button
          size="sm"
          className="h-7 px-3 text-xs gap-1.5"
          onClick={openAddDialog}
        >
          <Plus className="h-3.5 w-3.5" />
          Add New Line
        </Button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[52px_1fr_2fr_104px] px-3 py-1.5 border-b border-border bg-muted/30 shrink-0 text-[11px] font-semibold text-muted-foreground">
        <span>ID (Total: {entries.length})</span>
        <span>Key</span>
        <div className="flex items-center gap-2">
          <span>Value</span>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keyword Search"
            className="h-5 text-[11px] font-normal px-2 ml-auto w-44 bg-background"
          />
        </div>
        <span className="text-right pr-1">Actions</span>
      </div>

      {/* Virtual rows */}
      <div ref={parentRef} className="flex-1 overflow-auto min-h-0">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const entry = filteredEntries[vItem.index]
            const rowNum = vItem.index + 1
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
                className={`grid grid-cols-[52px_1fr_2fr_104px] px-3 items-center border-b border-border/50 hover:bg-muted/25 group ${vItem.index % 2 === 1 ? 'bg-muted/[0.07]' : ''}`}
              >
                {/* ID */}
                <span className="text-xs text-muted-foreground/60 font-mono tabular-nums">
                  {rowNum}
                </span>

                {/* Key / Field */}
                <span
                  className="font-mono text-xs truncate text-foreground pr-2"
                  title={entry.field}
                >
                  {entry.field}
                </span>

                {/* Value */}
                <span
                  className="font-mono text-xs truncate text-muted-foreground pr-2 cursor-pointer hover:text-foreground"
                  title={entry.value}
                  onClick={() => openViewDialog(entry)}
                >
                  {entry.value}
                </span>

                {/* Actions */}
                <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ActionBtn title="Copy value" onClick={() => handleCopyValue(entry.value)}>
                    <Copy className="h-3.5 w-3.5" />
                  </ActionBtn>
                  <ActionBtn title="Edit" onClick={() => openEditDialog(entry)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </ActionBtn>
                  <ActionBtn title="Delete" onClick={() => handleDeleteField(entry.field)} danger>
                    <Trash2 className="h-3.5 w-3.5" />
                  </ActionBtn>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit / View dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="max-w-2xl flex flex-col gap-0 p-0 h-[72vh]">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle className="text-sm">
              {dialogReadOnly ? 'View Hash Field' : 'Edit Hash Field'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 px-4 flex-1 min-h-0 pb-2">
            <div className="shrink-0">
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Field</label>
              <Input
                value={editField}
                onChange={(e) => !dialogReadOnly && setEditField(e.target.value)}
                readOnly={dialogReadOnly}
                className="h-7 text-xs font-mono px-2"
              />
            </div>
            <div className="flex flex-col flex-1 min-h-0">
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Value</label>
              <div className="flex-1 min-h-0 border border-border rounded-md overflow-hidden p-2">
                <FormatViewer
                  value={editValueBytes}
                  readOnly={dialogReadOnly}
                  onChange={dialogReadOnly ? undefined : setEditValueBytes}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-4 py-3 border-t border-border shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-3 text-xs"
              onClick={() => setDialogOpen(false)}
              disabled={editSaving}
            >
              {dialogReadOnly ? 'Close' : 'Cancel'}
            </Button>
            {!dialogReadOnly && (
              <Button
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={handleSaveEdit}
                disabled={editSaving || !editField.trim()}
              >
                {editSaving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Save
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="max-w-2xl flex flex-col gap-0 p-0 h-[72vh]">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle className="text-sm">Add Hash Field</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 px-4 flex-1 min-h-0 pb-2">
            <div className="shrink-0">
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Field</label>
              <Input
                value={newField}
                onChange={(e) => setNewField(e.target.value)}
                placeholder="Field name"
                className="h-7 text-xs font-mono px-2"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddField() }}
              />
            </div>
            <div className="flex flex-col flex-1 min-h-0">
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Value</label>
              <div className="flex-1 min-h-0 border border-border rounded-md overflow-hidden p-2">
                <FormatViewer
                  value={newValueBytes}
                  readOnly={false}
                  onChange={setNewValueBytes}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-4 py-3 border-t border-border shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-3 text-xs"
              onClick={() => setAddOpen(false)}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={handleAddField}
              disabled={adding || !newField.trim()}
            >
              {adding && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ActionBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1 rounded transition-colors ${
        danger
          ? 'text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  )
}
