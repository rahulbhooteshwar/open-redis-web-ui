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

interface ZSetEntry {
  member: string
  score: number
}

const ROW_HEIGHT = 36

function parseZSetValue(raw: string[]): ZSetEntry[] {
  const entries: ZSetEntry[] = []
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const member = raw[i]
    const score = parseFloat(raw[i + 1])
    entries.push({ member, score: Number.isNaN(score) ? 0 : score })
  }
  return entries
}

export function KeyContentZset({ connectionKey, keyName }: Props) {
  const [entries, setEntries] = useState<ZSetEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Inline edit state
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [editScoreDraft, setEditScoreDraft] = useState('')

  // Add new
  const [newMember, setNewMember] = useState('')
  const [newScore, setNewScore] = useState('')
  const [adding, setAdding] = useState(false)

  const parentRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/keys/${connectionKey}/get?keyName=${encodeURIComponent(keyName)}&type=zset`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const raw: string[] = Array.isArray(data.value) ? data.value : []
      setEntries(parseZSetValue(raw))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }, [connectionKey, keyName])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const handleSaveScore = useCallback(async (member: string) => {
    const score = parseFloat(editScoreDraft)
    if (Number.isNaN(score)) return
    try {
      const res = await fetch(`/api/redis/${connectionKey}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'ZADD', args: [keyName, score, member] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setEntries((prev) =>
        prev
          .map((e) => (e.member === member ? { ...e, score } : e))
          .sort((a, b) => a.score - b.score),
      )
      setEditingMember(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [connectionKey, keyName, editScoreDraft])

  const handleDelete = useCallback(async (member: string) => {
    try {
      const res = await fetch(`/api/redis/${connectionKey}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'ZREM', args: [keyName, member] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setEntries((prev) => prev.filter((e) => e.member !== member))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [connectionKey, keyName])

  const handleAdd = useCallback(async () => {
    const trimMember = newMember.trim()
    if (!trimMember) return
    const score = parseFloat(newScore)
    if (Number.isNaN(score)) return
    setAdding(true)
    try {
      const res = await fetch(`/api/redis/${connectionKey}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'ZADD', args: [keyName, score, trimMember] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setEntries((prev) => {
        const filtered = prev.filter((e) => e.member !== trimMember)
        return [...filtered, { member: trimMember, score }].sort((a, b) => a.score - b.score)
      })
      setNewMember('')
      setNewScore('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setAdding(false)
  }, [connectionKey, keyName, newMember, newScore])

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
        <Badge variant="secondary" className="text-xs">{entries.length} members</Badge>
        {error && <span className="text-xs text-destructive ml-2">{error}</span>}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[80px_1fr_80px] gap-2 px-3 py-1 border-b border-border bg-muted/20 shrink-0">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Score</span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Member</span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Actions</span>
      </div>

      {/* Virtual rows */}
      <div ref={parentRef} className="flex-1 overflow-auto min-h-0">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const entry = entries[vItem.index]
            const isEditing = editingMember === entry.member

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
                className={`grid grid-cols-[80px_1fr_80px] gap-2 px-3 items-center border-b border-border/50 hover:bg-muted/25 ${vItem.index % 2 === 1 ? 'bg-muted/[0.07]' : ''}`}
              >
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editScoreDraft}
                      onChange={(e) => setEditScoreDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveScore(entry.member)
                        if (e.key === 'Escape') setEditingMember(null)
                      }}
                      className="h-6 text-xs font-mono px-2 w-16"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveScore(entry.member)}
                      className="text-green-500 hover:text-green-400"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingMember(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="font-mono text-xs text-orange-400 tabular-nums">
                    {entry.score}
                  </span>
                )}

                <span className="font-mono text-xs truncate text-foreground" title={entry.member}>
                  {entry.member}
                </span>

                <div className="flex items-center gap-1">
                  {!isEditing && (
                    <button
                      onClick={() => {
                        setEditingMember(entry.member)
                        setEditScoreDraft(String(entry.score))
                      }}
                      className="text-muted-foreground/60 hover:text-foreground transition-colors"
                      title="Edit score"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(entry.member)}
                    className="text-muted-foreground/60 hover:text-destructive transition-colors"
                    title="Remove"
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
        <Input
          value={newScore}
          onChange={(e) => setNewScore(e.target.value)}
          placeholder="Score"
          className="h-7 text-xs font-mono px-2 w-20 shrink-0"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <Input
          value={newMember}
          onChange={(e) => setNewMember(e.target.value)}
          placeholder="Member"
          className="h-7 text-xs font-mono px-2 flex-1"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <Button
          size="sm"
          className="h-7 px-2 text-xs gap-1 shrink-0"
          onClick={handleAdd}
          disabled={adding || !newMember.trim() || !newScore.trim()}
        >
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add
        </Button>
      </div>
    </div>
  )
}
