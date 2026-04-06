'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useTabsStore } from '@/store/tabs'
import { useConnectionsStore } from '@/store/connections'
import { useActiveConnectionsStore } from '@/store/active-connections'
import { type Tab } from '@/types/tab'
import { getConnectionDisplayName } from '@/types/connection'
import { cn } from '@/lib/utils'
import { truncateLabel } from '@/lib/util'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// Icon/color per tab type
const TAB_TYPE_COLORS: Record<string, string> = {
  key: 'text-emerald-500',
  cli: 'text-amber-500',
  status: 'text-sky-500',
  delbatch: 'text-red-500',
  memory: 'text-[#A9C77D]',
  slowlog: 'text-orange-500',
}

interface TabItemProps {
  tab: Tab
  isSelected: boolean
  onSelect: () => void
  onClose: () => void
  onCloseOthers: () => void
  onCloseRight: () => void
  onCloseLeft: () => void
}

function TabItem({
  tab,
  isSelected,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseRight,
  onCloseLeft,
}: TabItemProps) {
  const colorClass = TAB_TYPE_COLORS[tab.type] ?? 'text-muted-foreground'

  const connections = useConnectionsStore((s) => s.connections)
  const activeConnections = useActiveConnectionsStore((s) => s.connections)

  const activeEntry = Array.from(activeConnections.values()).find(
    (e) => e.connectionKey === tab.connectionKey,
  )
  const connConfig = activeEntry ? connections.find((c) => c.key === activeEntry.configKey) : undefined
  const connColor = connConfig?.color
  const connName = connConfig ? getConnectionDisplayName(connConfig) : undefined

  const underlineColor = connColor ?? 'hsl(var(--primary))'

  return (
    <ContextMenu>
      <TooltipProvider delayDuration={600}>
        <Tooltip>
          <ContextMenuTrigger asChild>
            <TooltipTrigger asChild>
              <div
                role="tab"
                aria-selected={isSelected}
                className={cn(
                  'group relative flex items-center gap-1.5 px-3 py-1.5 cursor-pointer select-none',
                  'border-r border-border text-xs whitespace-nowrap flex-shrink-0',
                  'hover:bg-accent transition-colors',
                  isSelected
                    ? 'bg-background text-foreground border-b-2'
                    : 'bg-muted/40 text-muted-foreground border-b-2 border-b-transparent',
                )}
                style={{ minWidth: 80, maxWidth: 200, ...(isSelected ? { borderBottomColor: underlineColor } : {}) }}
                onClick={onSelect}
              >
                {/* Type color indicator */}
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', colorClass.replace('text-', 'bg-'))} />

                {/* Label */}
                <span className="truncate">{truncateLabel(tab.label, 20)}</span>

                {/* Close button */}
                <button
                  className={cn(
                    'ml-auto flex-shrink-0 rounded-sm p-0.5 transition-colors',
                    'opacity-0 group-hover:opacity-100',
                    isSelected && 'opacity-100',
                    'hover:bg-destructive/20 hover:text-destructive text-muted-foreground',
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose()
                  }}
                  title="Close tab"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </TooltipTrigger>
          </ContextMenuTrigger>
          {connName && (
            <TooltipContent side="bottom">
              <span>{connName}</span>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <ContextMenuContent>
        <ContextMenuItem onClick={onClose}>Close tab</ContextMenuItem>
        <ContextMenuItem onClick={onCloseOthers}>Close other tabs</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onCloseRight}>Close tabs to right</ContextMenuItem>
        <ContextMenuItem onClick={onCloseLeft}>Close tabs to left</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function TabBar() {
  const { tabs, selectedTabId, addTab, closeTab, closeOtherTabs, closeTabsToRight, closeTabsToLeft, selectTab } =
    useTabsStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Horizontal mouse-wheel scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault()
        if (selectedTabId) closeTab(selectedTabId)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        e.preventDefault()
        if (tabs.length < 2) return
        const idx = tabs.findIndex((t) => t.id === selectedTabId)
        const next = e.shiftKey
          ? tabs[(idx - 1 + tabs.length) % tabs.length]
          : tabs[(idx + 1) % tabs.length]
        if (next) selectTab(next.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tabs, selectedTabId, closeTab, selectTab])

  // Auto-scroll to selected tab
  useEffect(() => {
    if (!selectedTabId || !scrollRef.current) return
    const el = scrollRef.current.querySelector(`[aria-selected="true"]`)
    if (el) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [selectedTabId])

  if (tabs.length === 0) return null

  return (
    <div className="flex-shrink-0 border-b border-border bg-muted/30" style={{ height: 36 }}>
      <div
        ref={scrollRef}
        className="flex h-full overflow-x-auto overflow-y-hidden scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isSelected={tab.id === selectedTabId}
            onSelect={() => selectTab(tab.id)}
            onClose={() => closeTab(tab.id)}
            onCloseOthers={() => closeOtherTabs(tab.id)}
            onCloseRight={() => closeTabsToRight(tab.id)}
            onCloseLeft={() => closeTabsToLeft(tab.id)}
          />
        ))}
      </div>
    </div>
  )
}
