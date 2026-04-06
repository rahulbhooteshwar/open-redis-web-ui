'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Search, HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MemoryTab } from '@/types/tab'

interface Props { tab: MemoryTab }

interface KeyMemory {
  key: string
  bytes: number
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function MemoryAnalysisTab({ tab }: Props) {
  const [pattern, setPattern] = useState(tab.pattern || '*')
  const [scanning, setScanning] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [scannedCount, setScannedCount] = useState(0)
  const [analyzedCount, setAnalyzedCount] = useState(0)
  const [totalKeys, setTotalKeys] = useState(0)
  const [results, setResults] = useState<KeyMemory[]>([])

  const run = useCallback(async () => {
    setScanning(true)
    setAnalyzing(false)
    setScannedCount(0)
    setAnalyzedCount(0)
    setTotalKeys(0)
    setResults([])

    // Phase 1: collect all keys via cursor scan
    const keys: string[] = []
    let cursor = '0'
    try {
      do {
        const res = await fetch(
          `/api/keys/${tab.connectionKey}/scan?cursor=${cursor}&match=${encodeURIComponent(pattern)}&count=500`,
        )
        const data = await res.json()
        cursor = data.cursor
        keys.push(...(data.keys || []))
        setScannedCount(keys.length)
      } while (cursor !== '0')
    } catch {
      setScanning(false)
      return
    }

    setScanning(false)
    setTotalKeys(keys.length)

    if (keys.length === 0) return

    // Phase 2: fetch memory usage in batches of 50
    setAnalyzing(true)
    const keyMemories: KeyMemory[] = []
    const BATCH = 50

    for (let i = 0; i < keys.length; i += BATCH) {
      const batch = keys.slice(i, i + BATCH)
      const settled = await Promise.allSettled(
        batch.map(async (k) => {
          const res = await fetch(
            `/api/keys/${tab.connectionKey}/memory?keyName=${encodeURIComponent(k)}`,
          )
          const data = await res.json()
          return { key: k, bytes: data.usage != null ? parseInt(String(data.usage), 10) : 0 } as KeyMemory
        }),
      )
      for (const result of settled) {
        if (result.status === 'fulfilled') keyMemories.push(result.value)
      }
      setAnalyzedCount(keyMemories.length)
    }

    keyMemories.sort((a, b) => b.bytes - a.bytes)
    setResults(keyMemories)
    setAnalyzing(false)
  }, [pattern, tab.connectionKey])

  const hasAutoRunRef = useRef(false)
  useEffect(() => {
    if (!hasAutoRunRef.current) {
      hasAutoRunRef.current = true
      run()
    }
  }, [run])

  const busy = scanning || analyzing
  const totalBytes = results.reduce((sum, r) => sum + r.bytes, 0)

  return (
    <div className="p-4 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-semibold">Memory Analysis</h2>
      </div>

      <Card className="border-border/50 mb-4">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
            <Search className="h-3.5 w-3.5" />
            Scan Pattern
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex gap-2">
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. * or user:*"
              className="text-sm font-mono"
              disabled={busy}
            />
            <Button variant="secondary" size="sm" onClick={run} disabled={busy}>
              {scanning ? 'Scanning…' : analyzing ? 'Analyzing…' : 'Scan'}
            </Button>
          </div>

          {(scanning || analyzing) && (
            <div className="text-xs text-muted-foreground space-y-1">
              {scanning && <p>Scanning keys… {scannedCount.toLocaleString()} found</p>}
              {analyzing && (
                <p>
                  Analyzing memory usage… {analyzedCount.toLocaleString()} / {totalKeys.toLocaleString()} keys
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <HardDrive className="h-3.5 w-3.5" />
              Results
              <Badge variant="secondary" className="ml-1 font-mono normal-case">
                {results.length.toLocaleString()} keys
              </Badge>
              <Badge variant="outline" className="ml-1 font-mono normal-case">
                Total: {formatBytes(totalBytes)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="overflow-auto max-h-[60vh]">
              <div className="flex text-xs font-semibold text-muted-foreground border-b border-border/50 pb-1 mb-1 sticky top-0 bg-card">
                <span className="flex-1 min-w-0">Key</span>
                <span className="w-28 text-right shrink-0">Memory</span>
              </div>
              {results.map((r) => (
                <div
                  key={r.key}
                  className="flex items-center py-1 border-b border-border/20 last:border-0 gap-2"
                >
                  <span className="flex-1 min-w-0 text-xs font-mono truncate" title={r.key}>
                    {r.key}
                  </span>
                  <span className="w-28 text-right text-xs font-mono shrink-0 text-muted-foreground">
                    {formatBytes(r.bytes)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!busy && results.length === 0 && totalKeys === 0 && scannedCount > 0 && (
        <p className="text-xs text-muted-foreground">No keys matched the pattern.</p>
      )}
    </div>
  )
}
