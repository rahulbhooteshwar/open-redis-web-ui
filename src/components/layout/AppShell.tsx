'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useConnectionsStore } from '@/store/connections'
import { useSettingsStore } from '@/store/settings'
import { Sidebar } from './Sidebar'
import { TabBar } from '@/components/tabs/TabBar'
import { TabContent } from '@/components/tabs/TabContent'

const MIN_SIDEBAR_WIDTH = 530
const MAX_SIDEBAR_WIDTH = 800
const DEFAULT_SIDEBAR_WIDTH = 530

export function AppShell() {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  // Apply persisted display settings on mount
  useEffect(() => {
    const { zoomFactor } = useSettingsStore.getState()
    if (zoomFactor !== 1.0) {
      document.documentElement.style.zoom = String(zoomFactor)
    }
  }, [])

  useEffect(() => {
    // Load connections on mount
    useConnectionsStore.getState().fetchConnections()

    // Cleanup all redis connections on page unload
    const handleBeforeUnload = () => {
      navigator.sendBeacon('/api/redis/disconnect-all', JSON.stringify({}))
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  const handleMouseDownDivider = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartX.current = e.clientX
    dragStartWidth.current = sidebarWidth
    setIsDragging(true)

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - dragStartX.current
      const newWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, dragStartWidth.current + delta),
      )
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [sidebarWidth])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <div
        className="flex-shrink-0 flex flex-col border-r border-sidebar-border bg-[hsl(var(--sidebar))] transition-all duration-200 relative"
        style={{ width: sidebarCollapsed ? 48 : sidebarWidth }}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />
      </div>

      {/* Draggable divider */}
      {!sidebarCollapsed && (
        <div
          className={`w-1 flex-shrink-0 cursor-col-resize hover:bg-primary/40 transition-colors ${
            isDragging ? 'bg-primary/60' : 'bg-transparent'
          }`}
          onMouseDown={handleMouseDownDivider}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TabBar />
        <div className="flex-1 overflow-hidden">
          <TabContent />
        </div>
      </div>
    </div>
  )
}
