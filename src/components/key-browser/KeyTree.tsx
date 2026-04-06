'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronRight, Folder, FolderOpen, Key, Loader2, Plus } from 'lucide-react'
import { useTabsStore } from '@/store/tabs'
import { bufToString, flattenTree, type TreeNode } from '@/lib/util'
import { cn } from '@/lib/utils'

interface FlatNode {
  node: TreeNode
  depth: number
  isExpanded: boolean
}

interface KeyTreeProps {
  nodes: TreeNode[]
  connectionKey: string
  connColor?: string
  loading?: boolean
  onNewKey?: () => void
}

const ITEM_HEIGHT = 34

// Key type colors for leaf icons
const TYPE_COLORS: Record<string, string> = {
  string: 'text-blue-400',
  hash: 'text-yellow-400',
  list: 'text-green-400',
  set: 'text-orange-400',
  zset: 'text-[#A9C77D]',
  stream: 'text-pink-400',
  ReJSON: 'text-cyan-400',
}

export function KeyTree({ nodes, connectionKey, connColor, loading, onNewKey }: KeyTreeProps) {
  const folderColor = connColor ?? 'hsl(var(--primary))'
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const addTab = useTabsStore((s) => s.addTab)

  const flatNodes = useMemo<FlatNode[]>(() => {
    return flattenTree(nodes, expandedKeys)
  }, [nodes, expandedKeys])

  const virtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 15,
  })

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const openKey = useCallback(async (node: TreeNode) => {
    if (!node.isLeaf || !node.fullKey) return
    setSelectedKey(node.key)

    const keyName = bufToString(node.fullKey)
    let keyType = 'string'
    try {
      const res = await fetch(`/api/keys/${connectionKey}/type?keyName=${encodeURIComponent(keyName)}`)
      if (res.ok) {
        const data = await res.json()
        keyType = data.type || 'string'
      }
    } catch { /* ignore */ }

    addTab({
      id: `key-${connectionKey}-${node.key}-${Date.now()}`,
      type: 'key',
      connectionKey,
      redisKey: btoa(String.fromCharCode(...(node.fullKey || new Uint8Array()))),
      keyType,
      label: bufToString(node.nameBuffer).slice(0, 20),
      title: keyName,
    })
  }, [connectionKey, addTab])

  if (loading && flatNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[16px]">Loading keys…</span>
      </div>
    )
  }

  if (!loading && flatNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <span className="text-[16px]">No keys found</span>
        {onNewKey && (
          <button
            onClick={onNewKey}
            className="flex items-center gap-1.5 text-[13px] text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Add new key
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const { node, depth, isExpanded } = flatNodes[virtualItem.index]
          const isSelected = selectedKey === node.key

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${ITEM_HEIGHT}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div
                className={cn(
                  'flex items-center gap-1 px-1 cursor-pointer select-none rounded-sm mx-1',
                  'hover:bg-accent/50 transition-colors text-[16px]',
                  isSelected && 'bg-primary/15 text-primary',
                )}
                style={{ paddingLeft: `${depth * 12 + 4}px`, height: ITEM_HEIGHT }}
                onClick={() => {
                  if (node.isLeaf) {
                    openKey(node)
                  } else {
                    toggleExpand(node.key)
                  }
                }}
              >
                {!node.isLeaf && (
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
                      isExpanded && 'rotate-90',
                    )}
                  />
                )}
                {node.isLeaf ? (
                  <Key className={cn('h-4 w-4 flex-shrink-0', TYPE_COLORS[node.keyType || 'string'] || 'text-muted-foreground')} />
                ) : isExpanded ? (
                  <FolderOpen className="h-4 w-4 flex-shrink-0" style={{ color: folderColor }} />
                ) : (
                  <Folder className="h-4 w-4 flex-shrink-0" style={{ color: folderColor, opacity: 0.75 }} />
                )}
                <span className="truncate flex-1 leading-none">
                  {bufToString(node.nameBuffer)}
                </span>
                {!node.isLeaf && node.keyCount > 0 && (
                  <span className="text-[13px] text-muted-foreground/60 flex-shrink-0">
                    {node.keyCount}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
