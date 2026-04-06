'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader2, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface Props {
  connectionKey: string
  keyName: string
}

const ROW_HEIGHT = 36

export function KeyContentSet({ connectionKey, keyName }: Props) {
  const [members, setMembers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newMember, setNewMember] = useState('')
  const [adding, setAdding] = useState(false)

  const parentRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/keys/${connectionKey}/get?keyName=${encodeURIComponent(keyName)}&type=set`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setMembers(Array.isArray(data.value) ? data.value : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }, [connectionKey, keyName])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const virtualizer = useVirtualizer({
    count: members.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const handleDelete = useCallback(async (member: string) => {
    try {
      const res = await fetch(`/api/redis/${connectionKey}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'SREM', args: [keyName, member] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setMembers((prev) => prev.filter((m) => m !== member))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [connectionKey, keyName])

  const handleAdd = useCallback(async () => {
    const trimmed = newMember.trim()
    if (!trimmed) return
    setAdding(true)
    try {
      const res = await fetch(`/api/redis/${connectionKey}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'SADD', args: [keyName, trimmed] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setMembers((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
      setNewMember('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setAdding(false)
  }, [connectionKey, keyName, newMember])

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
        <Badge variant="secondary" className="text-xs">{members.length} members</Badge>
        {error && <span className="text-xs text-destructive ml-2">{error}</span>}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_48px] gap-2 px-3 py-1 border-b border-border bg-muted/20 shrink-0">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Member</span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Actions</span>
      </div>

      {/* Virtual rows */}
      <div ref={parentRef} className="flex-1 overflow-auto min-h-0">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const member = members[vItem.index]
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
                className={`grid grid-cols-[1fr_48px] gap-2 px-3 items-center border-b border-border/50 hover:bg-muted/25 ${vItem.index % 2 === 1 ? 'bg-muted/[0.07]' : ''}`}
              >
                <span className="font-mono text-xs truncate text-foreground" title={member}>
                  {member}
                </span>
                <div className="flex items-center">
                  <button
                    onClick={() => handleDelete(member)}
                    className="text-muted-foreground/60 hover:text-destructive transition-colors"
                    title="Remove member"
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
          value={newMember}
          onChange={(e) => setNewMember(e.target.value)}
          placeholder="New member"
          className="h-7 text-xs font-mono px-2 flex-1"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <Button
          size="sm"
          className="h-7 px-2 text-xs gap-1 shrink-0"
          onClick={handleAdd}
          disabled={adding || !newMember.trim()}
        >
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add
        </Button>
      </div>
    </div>
  )
}
