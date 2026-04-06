'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SlowLogTab as SlowLogTabType } from '@/types/tab'

interface Props { tab: SlowLogTabType }

interface SlowLogEntry {
  id: number
  timestamp: number
  durationMicros: number
  args: string[]
  client: string
  clientName: string
}

function parseEntries(raw: unknown): SlowLogEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    if (!Array.isArray(entry)) return null
    const [id, timestamp, durationMicros, cmdArgs, client, clientName] = entry
    return {
      id: typeof id === 'number' ? id : Number(id),
      timestamp: typeof timestamp === 'number' ? timestamp : Number(timestamp),
      durationMicros: typeof durationMicros === 'number' ? durationMicros : Number(durationMicros),
      args: Array.isArray(cmdArgs) ? cmdArgs.map(String) : [],
      client: typeof client === 'string' ? client : String(client ?? ''),
      clientName: typeof clientName === 'string' ? clientName : String(clientName ?? ''),
    } satisfies SlowLogEntry
  }).filter((e): e is SlowLogEntry => e !== null)
}

function formatCommand(args: string[]): string {
  const full = args.join(' ')
  return full.length > 80 ? full.slice(0, 77) + '…' : full
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString()
}

function formatDuration(micros: number): string {
  return (micros / 1000).toFixed(2)
}

export function SlowLogTab({ tab }: Props) {
  const [entries, setEntries] = useState<SlowLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLog = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/server/${tab.connectionKey}/slowlog?count=128`)
      const data = await res.json()
      setEntries(parseEntries(data.log))
    } catch {
      setEntries([])
    }
    setLoading(false)
  }, [tab.connectionKey])

  useEffect(() => { fetchLog() }, [fetchLog])

  return (
    <div className="p-4 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Slow Log</h2>
          {!loading && (
            <Badge variant="secondary" className="font-mono text-xs">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchLog} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
            <Clock className="h-3.5 w-3.5" />
            Slow Commands
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {entries.length === 0 && !loading ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No slow log entries.</p>
          ) : (
            <div className="overflow-auto">
              {/* Header row */}
              <div className="grid grid-cols-[2rem_10rem_6rem_1fr_10rem] gap-2 text-xs font-semibold text-muted-foreground border-b border-border/50 pb-1 mb-1 sticky top-0 bg-card">
                <span>#</span>
                <span>Timestamp</span>
                <span>Duration (ms)</span>
                <span>Command</span>
                <span>Client</span>
              </div>
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-[2rem_10rem_6rem_1fr_10rem] gap-2 items-center py-1.5 border-b border-border/20 last:border-0 text-xs"
                >
                  <span className="font-mono text-muted-foreground">{entry.id}</span>
                  <span className="text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                  <span className="font-mono">
                    <Badge variant="outline" className="text-xs font-mono px-1 py-0">
                      {formatDuration(entry.durationMicros)} ms
                    </Badge>
                  </span>
                  <span className="font-mono truncate" title={entry.args.join(' ')}>
                    {formatCommand(entry.args)}
                  </span>
                  <span className="text-muted-foreground truncate font-mono" title={entry.client}>
                    {entry.clientName ? `${entry.clientName} (${entry.client})` : entry.client}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
