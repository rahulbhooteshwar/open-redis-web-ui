'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { KeyboardSensor } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useConnectionsStore } from '@/store/connections'
import { type StoredConnection } from '@/types/connection'
import { ConnectionItem } from './ConnectionItem'
import { ConnectionIcon } from './ConnectionIcon'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Sortable wrapper
// ---------------------------------------------------------------------------

function SortableConnectionItem({
  connection,
  collapsed,
  onExpand,
  index,
}: {
  connection: StoredConnection
  collapsed: boolean
  onExpand?: () => void
  index: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: connection.key,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {collapsed ? (
        <div
          className="flex items-center justify-center py-1 px-1 cursor-grab active:cursor-grabbing"
          {...listeners}
          onClick={onExpand}
        >
          <ConnectionIcon connection={connection} />
        </div>
      ) : (
        <div {...listeners} className="cursor-grab active:cursor-grabbing">
          <ConnectionItem connection={connection} index={index} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConnectionList
// ---------------------------------------------------------------------------

interface ConnectionListProps {
  collapsed: boolean
  onExpand?: () => void
}

export function ConnectionList({ collapsed, onExpand }: ConnectionListProps) {
  const { connections, loading } = useConnectionsStore()
  const [search, setSearch] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const filtered = useMemo(() => {
    const sorted = [...connections].sort((a, b) => a.order - b.order)
    if (!search.trim()) return sorted
    const q = search.toLowerCase()
    return sorted.filter((c) => {
      const name = (c.name ?? c.connectionName ?? `${c.host}:${c.port}`).toLowerCase()
      return name.includes(q) || c.host.toLowerCase().includes(q)
    })
  }, [connections, search])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = filtered.findIndex((c) => c.key === active.id)
    const newIndex = filtered.findIndex((c) => c.key === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reorderedFiltered = arrayMove(filtered, oldIndex, newIndex)

    // Merge reordered filtered items back into the full connections list so that
    // non-filtered connections are not lost when a search is active.
    const filteredKeySet = new Set(filtered.map((c) => c.key))
    const allSorted = [...connections].sort((a, b) => a.order - b.order)
    let fi = 0
    const fullReordered = allSorted
      .map((c) => (filteredKeySet.has(c.key) ? reorderedFiltered[fi++] : c))
      .map((c, i) => ({ ...c, order: i }))

    useConnectionsStore.getState().reorderConnections(fullReordered)
  }

  if (loading && connections.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-[13px]">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Search input — only show when > 4 connections and not collapsed */}
      {!collapsed && connections.length > 4 && (
        <div className="px-2 pt-2 pb-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter connections..."
              className="h-6 text-[13px] pl-6"
            />
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-[13px] gap-2 px-3 text-center">
          {connections.length === 0 ? (
            <>
              <p>No connections yet.</p>
              <p>Click + to add one.</p>
            </>
          ) : (
            <p>No connections match your search.</p>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filtered.map((c) => c.key)}
          strategy={verticalListSortingStrategy}
        >
          <div className={cn('flex flex-col py-2 gap-2', collapsed && 'items-center')}>
            {filtered.map((connection, i) => (
              <SortableConnectionItem
                key={connection.key}
                connection={connection}
                collapsed={collapsed}
                onExpand={onExpand}
                index={i}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
