'use client'

import { useState, useCallback } from 'react'
import { Trash2, Search, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DelBatchTab } from '@/types/tab'

interface Props { tab: DelBatchTab }

export function DeleteBatchTab({ tab }: Props) {
  const [pattern, setPattern] = useState(tab.pattern || '*')
  const [scanned, setScanned] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(0)

  const scan = useCallback(async () => {
    setScanning(true)
    setScanned([])
    const keys: string[] = []
    let cursor = '0'
    try {
      do {
        const res = await fetch(`/api/keys/${tab.connectionKey}/scan?cursor=${cursor}&match=${encodeURIComponent(pattern)}&count=500`)
        const data = await res.json()
        cursor = data.cursor
        keys.push(...(data.keys || []))
        setScanned([...keys])
      } while (cursor !== '0')
    } catch { /* ignore */ }
    setScanning(false)
  }, [pattern, tab.connectionKey])

  const deleteAll = useCallback(async () => {
    if (!scanned.length || deleting) return
    setDeleting(true)
    let count = 0
    // Delete in batches of 500
    for (let i = 0; i < scanned.length; i += 500) {
      const batch = scanned.slice(i, i + 500)
      try {
        await Promise.all(
          batch.map((k) =>
            fetch(`/api/keys/${tab.connectionKey}/delete?keyName=${encodeURIComponent(k)}`, { method: 'DELETE' }),
          ),
        )
        count += batch.length
        setDeleted(count)
      } catch { /* ignore */ }
    }
    setScanned([])
    setDeleting(false)
  }, [scanned, deleting, tab.connectionKey])

  return (
    <div className="p-4 max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-semibold">Batch Delete Keys</h2>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
            <Search className="h-3.5 w-3.5" />
            Pattern Scan
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex gap-2">
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. user:* or session:*"
              className="text-sm font-mono"
            />
            <Button variant="secondary" size="sm" onClick={scan} disabled={scanning}>
              {scanning ? 'Scanning…' : 'Scan'}
            </Button>
          </div>

          {scanned.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{scanned.length.toLocaleString()} keys found</Badge>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs text-muted-foreground">This action is irreversible</span>
                </div>
              </div>

              <div className="max-h-48 overflow-auto border rounded-md p-2 bg-muted/20">
                {scanned.slice(0, 200).map((k) => (
                  <div key={k} className="text-xs font-mono text-muted-foreground truncate py-0.5 border-b border-border/20 last:border-0">
                    {k}
                  </div>
                ))}
                {scanned.length > 200 && (
                  <div className="text-xs text-muted-foreground/50 text-center py-1">
                    ... and {(scanned.length - 200).toLocaleString()} more
                  </div>
                )}
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={deleteAll}
                disabled={deleting}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? `Deleting… (${deleted.toLocaleString()} / ${scanned.length.toLocaleString()})` : `Delete All ${scanned.length.toLocaleString()} Keys`}
              </Button>
            </div>
          )}

          {deleted > 0 && scanned.length === 0 && (
            <div className="text-sm text-green-500 font-medium">
              ✓ Deleted {deleted.toLocaleString()} keys
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
