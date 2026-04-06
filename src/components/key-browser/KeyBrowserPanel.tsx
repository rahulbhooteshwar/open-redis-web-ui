'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useActiveConnectionsStore } from '@/store/active-connections'
import { useConnectionsStore } from '@/store/connections'
import { useSettingsStore } from '@/store/settings'
import { keysToTree, type TreeNode } from '@/lib/util'
import { KeyTree } from './KeyTree'

interface KeyBrowserPanelProps {
  configKey: string
  connectionKey: string
  db: number
  onNewKey?: () => void
  refreshTrigger?: number
}

interface DbInfo {
  index: number
  keyCount: number
}

function toMatchPattern(input: string): string {
  if (!input) return '*'
  if (/[*?[]/.test(input)) return input
  return `*${input}*`
}

export function KeyBrowserPanel({ configKey, connectionKey, db, onNewKey, refreshTrigger }: KeyBrowserPanelProps) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [keyCount, setKeyCount] = useState(0)
  const [dbs, setDbs] = useState<DbInfo[]>([])
  const [selectedDb, setSelectedDb] = useState(db)
  const [searchPattern, setSearchPattern] = useState('')
  const keySeparator = useSettingsStore((s) => s.keySeparator)
  const activeEntry = useActiveConnectionsStore((s) => s.getConnection(configKey))
  const connColor = useConnectionsStore((s) => s.connections.find((c) => c.key === configKey)?.color)
  const abortRef = useRef<AbortController | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadDbs = useCallback(async () => {
    try {
      const res = await fetch(`/api/redis/${connectionKey}/dbs`)
      if (!res.ok) return
      const data = await res.json()
      if (data.dbconfig) {
        const dbCount = parseInt(data.dbconfig[1] || '16') || 16
        const keyspaceLines: string[] = (data.keyspace || '').split('\n').filter(Boolean)
        const keyspaceCounts: Record<number, number> = {}
        for (const line of keyspaceLines) {
          const match = line.match(/^db(\d+):keys=(\d+)/)
          if (match) keyspaceCounts[parseInt(match[1])] = parseInt(match[2])
        }
        setDbs(Array.from({ length: dbCount }, (_, i) => ({
          index: i,
          keyCount: keyspaceCounts[i] || 0,
        })))
      }
    } catch { /* ignore */ }
  }, [connectionKey])

  const scanKeys = useCallback(async (targetDb: number, pattern = '*') => {
    if (!connectionKey) return

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setTree([])
    setKeyCount(0)

    const allKeys: Uint8Array[] = []
    let cursor = '0'

    try {
      if (targetDb !== selectedDb) {
        await fetch(`/api/redis/${connectionKey}/select`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ db: targetDb }),
          signal: controller.signal,
        })
      }

      do {
        const url = `/api/keys/${connectionKey}/scan?cursor=${cursor}&match=${encodeURIComponent(pattern)}&count=500`
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) break
        const data = await res.json()
        cursor = data.cursor

        if (data.keys && data.keys.length > 0) {
          const newKeys = data.keys.map((k: string) => new TextEncoder().encode(k))
          allKeys.push(...newKeys)
          setKeyCount(allKeys.length)
          setTree(keysToTree(allKeys, keySeparator))
        }
      } while (cursor !== '0' && !controller.signal.aborted)

      if (!controller.signal.aborted) setLoading(false)
    } catch (e: any) {
      if (e.name !== 'AbortError') setLoading(false)
    }
  }, [connectionKey, selectedDb, keySeparator])

  useEffect(() => {
    loadDbs()
    scanKeys(selectedDb, toMatchPattern(searchPattern))
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [connectionKey, db, refreshTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      scanKeys(selectedDb, toMatchPattern(searchPattern))
    }, 400)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchPattern]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDbChange = useCallback((newDb: number) => {
    setSelectedDb(newDb)
    if (activeEntry) useActiveConnectionsStore.getState().updateDb(configKey, newDb)
    scanKeys(newDb, toMatchPattern(searchPattern))
  }, [activeEntry, configKey, scanKeys, searchPattern])

  const handleRefresh = useCallback(() => {
    scanKeys(selectedDb, toMatchPattern(searchPattern))
    loadDbs()
  }, [loadDbs, scanKeys, selectedDb, searchPattern])

  const keyCountLabel = keyCount > 0
    ? `${keyCount.toLocaleString()} ${searchPattern ? 'matches' : 'keys'}`
    : loading ? 'Loading…' : ''

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar: DB selector + key count + refresh */}
      <div className="flex items-center gap-1 pb-1">
        {dbs.length > 1 ? (
          <Select value={String(selectedDb)} onValueChange={(v) => handleDbChange(parseInt(v, 10))}>
            <SelectTrigger className="h-6 text-[13px] flex-1">
              <SelectValue placeholder="db" />
            </SelectTrigger>
            <SelectContent>
              {dbs.map((d) => (
                <SelectItem key={d.index} value={String(d.index)} className="text-[13px]">
                  db{d.index}
                  {d.keyCount > 0 && (
                    <span className="ml-1 text-muted-foreground">({d.keyCount.toLocaleString()})</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-[11px] text-muted-foreground flex-1">
            {keyCountLabel}
          </span>
        )}
        {dbs.length > 1 && keyCount > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {keyCount.toLocaleString()}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={`h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground ${loading ? 'animate-spin' : ''}`}
          onClick={handleRefresh}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {/* Search input */}
      <div className="relative pb-1">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchPattern}
          onChange={(e) => setSearchPattern(e.target.value)}
          placeholder="Search keys…"
          className="w-full h-6 pl-6 pr-6 text-[12px] bg-transparent border border-input rounded-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
        />
        {searchPattern && (
          <button
            onClick={() => setSearchPattern('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Key tree */}
      <div className="flex-1 overflow-hidden">
        <KeyTree
          nodes={tree}
          connectionKey={connectionKey}
          connColor={connColor}
          loading={loading}
          onNewKey={onNewKey}
        />
      </div>
    </div>
  )
}
