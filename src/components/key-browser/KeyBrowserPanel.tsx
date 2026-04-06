'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
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

export function KeyBrowserPanel({ configKey, connectionKey, db, onNewKey, refreshTrigger }: KeyBrowserPanelProps) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [keyCount, setKeyCount] = useState(0)
  const [dbs, setDbs] = useState<DbInfo[]>([])
  const [selectedDb, setSelectedDb] = useState(db)
  const keySeparator = useSettingsStore((s) => s.keySeparator)
  const activeEntry = useActiveConnectionsStore((s) => s.getConnection(configKey))
  const connColor = useConnectionsStore((s) => s.connections.find((c) => c.key === configKey)?.color)
  const abortRef = useRef<AbortController | null>(null)

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

  const scanKeys = useCallback(async (targetDb: number) => {
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
        const url = `/api/keys/${connectionKey}/scan?cursor=${cursor}&match=*&count=500`
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
    scanKeys(selectedDb)
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [connectionKey, db, refreshTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDbChange = useCallback((newDb: number) => {
    setSelectedDb(newDb)
    if (activeEntry) useActiveConnectionsStore.getState().updateDb(configKey, newDb)
    scanKeys(newDb)
  }, [activeEntry, configKey, scanKeys])

  const handleRefresh = useCallback(() => {
    scanKeys(selectedDb)
    loadDbs()
  }, [loadDbs, scanKeys, selectedDb])

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
            {keyCount > 0 ? `${keyCount.toLocaleString()} keys` : loading ? 'Loading…' : ''}
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
