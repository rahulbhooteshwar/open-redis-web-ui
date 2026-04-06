'use client'

import { Layers } from 'lucide-react'
import { useTabsStore } from '@/store/tabs'
import { type Tab } from '@/types/tab'
import { lazy, Suspense } from 'react'

// Lazy-load heavy tab content components
const KeyDetail = lazy(() =>
  import('@/components/key-detail/KeyDetail').then((m) => ({ default: m.KeyDetail })),
)
const CliTab = lazy(() =>
  import('@/components/tabs-content/CliTab').then((m) => ({ default: m.CliTab })),
)
const StatusTab = lazy(() =>
  import('@/components/tabs-content/StatusTab').then((m) => ({ default: m.StatusTab })),
)
const DeleteBatchTab = lazy(() =>
  import('@/components/tabs-content/DeleteBatchTab').then((m) => ({ default: m.DeleteBatchTab })),
)
const MemoryAnalysisTab = lazy(() =>
  import('@/components/tabs-content/MemoryAnalysisTab').then((m) => ({
    default: m.MemoryAnalysisTab,
  })),
)
const SlowLogTab = lazy(() =>
  import('@/components/tabs-content/SlowLogTab').then((m) => ({ default: m.SlowLogTab })),
)

function TabSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Loading...
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

function renderTab(tab: Tab) {
  switch (tab.type) {
    case 'key':
      return (
        <TabSuspense>
          <KeyDetail tab={tab} />
        </TabSuspense>
      )
    case 'cli':
      return (
        <TabSuspense>
          <CliTab tab={tab} />
        </TabSuspense>
      )
    case 'status':
      return (
        <TabSuspense>
          <StatusTab tab={tab} />
        </TabSuspense>
      )
    case 'delbatch':
      return (
        <TabSuspense>
          <DeleteBatchTab tab={tab} />
        </TabSuspense>
      )
    case 'memory':
      return (
        <TabSuspense>
          <MemoryAnalysisTab tab={tab} />
        </TabSuspense>
      )
    case 'slowlog':
      return (
        <TabSuspense>
          <SlowLogTab tab={tab} />
        </TabSuspense>
      )
    default:
      return null
  }
}

export function TabContent() {
  const { tabs, selectedTabId } = useTabsStore()
  const selectedTab = tabs.find((t) => t.id === selectedTabId)

  if (!selectedTab) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <Layers className="h-12 w-12 opacity-20" />
        <p className="text-sm">Select a connection and click a key to get started.</p>
        <p className="text-xs">Or use the CLI / Status buttons on any connection.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      {/* Render all tabs but only show the selected one — avoids remounting */}
      {tabs.map((tab) => (
        <div key={tab.id} className={tab.id === selectedTabId ? 'h-full' : 'hidden'}>
          {renderTab(tab)}
        </div>
      ))}
    </div>
  )
}
