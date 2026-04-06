'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Props {
  connectionKey: string
  keyName: string
}

interface StreamEntry {
  id: string
  fields: Record<string, string>
  ts: number
}

function parseEntries(raw: unknown): StreamEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const [id, fieldArr] = entry as [string, string[]]
    const fields: Record<string, string> = {}
    for (let i = 0; i < (fieldArr || []).length - 1; i += 2) {
      fields[fieldArr[i]] = fieldArr[i + 1]
    }
    const ts = parseInt(id.split('-')[0], 10)
    return { id, fields, ts }
  })
}

export function KeyContentStream({ connectionKey, keyName }: Props) {
  const [entries, setEntries] = useState<StreamEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [getRes, lenRes] = await Promise.all([
        fetch(`/api/keys/${connectionKey}/get?keyName=${encodeURIComponent(keyName)}&type=stream`),
        fetch(`/api/redis/${connectionKey}/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'XLEN', args: [keyName] }),
        }),
      ])
      const getData = await getRes.json()
      const lenData = await lenRes.json()
      setEntries(parseEntries(getData.value))
      setTotal(lenData.result ?? 0)
    } catch { /* ignore */ }
    setLoading(false)
  }, [connectionKey, keyName])

  const loadMore = useCallback(async () => {
    if (entries.length === 0) return
    const lastId = entries[entries.length - 1].id
    setLoading(true)
    try {
      const res = await fetch(`/api/redis/${connectionKey}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'XRANGE', args: [keyName, `(${lastId}`, '+', 'COUNT', 200] }),
      })
      const data = await res.json()
      const more = parseEntries(data.result ?? [])
      setEntries((prev) => [...prev, ...more])
    } catch { /* ignore */ }
    setLoading(false)
  }, [connectionKey, keyName, entries])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {entries.length.toLocaleString()} / {total.toLocaleString()} entries
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="grid grid-cols-[200px_150px_1fr] text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1.5 border-b border-border/50 sticky top-0 bg-background">
          <span>ID</span>
          <span>Timestamp</span>
          <span>Fields</span>
        </div>

        {entries.length === 0 && !loading && (
          <div className="text-center text-muted-foreground text-sm py-8">No entries</div>
        )}

        {entries.map((entry, idx) => (
          <div
            key={entry.id}
            className={`grid grid-cols-[200px_150px_1fr] text-xs px-3 py-1.5 border-b border-border/50 hover:bg-muted/25 ${idx % 2 === 1 ? 'bg-muted/[0.07]' : ''}`}
          >
            <span className="font-mono text-primary truncate">{entry.id}</span>
            <span className="text-muted-foreground">
              {entry.ts ? new Date(entry.ts).toLocaleTimeString() : '—'}
            </span>
            <span className="font-mono truncate text-muted-foreground">
              {Object.entries(entry.fields)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' | ')}
            </span>
          </div>
        ))}

        {entries.length < total && (
          <div className="p-3 text-center">
            <Button variant="secondary" size="sm" onClick={loadMore} disabled={loading}>
              Load more ({(total - entries.length).toLocaleString()} remaining)
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
