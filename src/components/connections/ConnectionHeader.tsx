'use client'

import { useState } from 'react'
import {
  Terminal,
  Activity,
  RefreshCw,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Database,
  BarChart2,
  Clock,
  AlertTriangle,
  FilePlus2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useTabsStore } from '@/store/tabs'
import { getConnectionDisplayName, type StoredConnection } from '@/types/connection'
import { cn } from '@/lib/utils'
import { nanoid } from 'nanoid'

const CONNECTION_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#0ea5e9', // Sky
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#A9C77D', // Sage
  '#64748b', // Slate
]

interface ConnectionHeaderProps {
  connection: StoredConnection
  connectionKey: string | null
  isConnected: boolean
  onEdit: () => void
  onDelete: () => void
  onFlushDb: () => void
  onNewKey?: () => void
  onColorChange?: (color: string) => void
}

export function ConnectionHeader({
  connection,
  connectionKey,
  isConnected,
  onEdit,
  onDelete,
  onFlushDb,
  onNewKey,
  onColorChange,
}: ConnectionHeaderProps) {
  const displayName = getConnectionDisplayName(connection)
  const [flushConfirmOpen, setFlushConfirmOpen] = useState(false)

  const openStatusTab = () => {
    if (!connectionKey) return
    useTabsStore.getState().addTab({
      id: nanoid(),
      type: 'status',
      connectionKey,
      label: `Status: ${displayName}`,
      title: `Status: ${displayName}`,
    })
  }

  const openCliTab = () => {
    if (!connectionKey) return
    useTabsStore.getState().addTab({
      id: nanoid(),
      type: 'cli',
      connectionKey,
      label: `CLI: ${displayName}`,
      title: `CLI: ${displayName}`,
    })
  }

  const openMemoryTab = () => {
    if (!connectionKey) return
    useTabsStore.getState().addTab({
      id: nanoid(),
      type: 'memory',
      connectionKey,
      label: `Memory: ${displayName}`,
      title: `Memory Analysis: ${displayName}`,
    })
  }

  const openSlowlogTab = () => {
    if (!connectionKey) return
    useTabsStore.getState().addTab({
      id: nanoid(),
      type: 'slowlog',
      connectionKey,
      label: `Slowlog: ${displayName}`,
      title: `Slow Log: ${displayName}`,
    })
  }

  const handleDuplicate = async () => {
    const { addConnection } = useConnectionsStore_action()
    await addConnection({ ...connection })
  }

  return (
    <>
    <div
      className="flex items-center gap-1 w-full min-w-0 connection-color-accent pl-2 pr-1 py-2"
      style={{ '--conn-color': connection.color ?? 'hsl(var(--primary))' } as React.CSSProperties}
    >


      {/* Connection name */}
      <span className="flex-1 flex items-center gap-1.5 min-w-0">
        {connection.emoji && (
          <span className="flex-shrink-0 leading-none">{connection.emoji}</span>
        )}
        <span className="text-[15px] font-bold truncate text-sidebar-foreground">{displayName}</span>
      </span>

      {/* Status dot */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="flex-shrink-0 p-2 rounded hover:bg-accent"
            onClick={(e) => { e.stopPropagation(); openStatusTab() }}
            disabled={!connectionKey}
          >
            <span
              className={cn(
                'block w-4 h-4 rounded-full',
                isConnected ? 'status-dot-connected' : 'status-dot-disconnected',
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {isConnected ? 'Connected — click to open server info' : 'Disconnected'}
        </TooltipContent>
      </Tooltip>

      {/* Action icons (show on hover) */}
      <div className="flex items-center gap-0.5">
        {connectionKey && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    openCliTab()
                  }}
                >
                  <Terminal className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open CLI</TooltipContent>
            </Tooltip>
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="mr-2 h-3.5 w-3.5" />
              Edit connection
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={async () => {
                try {
                  const { addConnection } = await import('@/store/connections').then(
                    (m) => m.useConnectionsStore.getState(),
                  )
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const { key: _k, order: _o, ...rest } = connection
                  await addConnection(rest)
                } catch {/* ignore */}
              }}
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              Duplicate
            </DropdownMenuItem>

            {/* Color picker */}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground pb-1">
              Connection color
            </DropdownMenuLabel>
            <div className="grid grid-cols-7 gap-1 px-2 pb-2">
              {CONNECTION_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 transition-all hover:scale-110',
                    connection.color === color
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:border-foreground/40',
                  )}
                  style={{ backgroundColor: color }}
                  onClick={(e) => { e.stopPropagation(); onColorChange?.(color) }}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              ))}
              {/* Custom color picker */}
              <div
                className="relative w-5 h-5"
                title="Custom color"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <input
                  type="color"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  defaultValue={connection.color?.startsWith('#') ? connection.color : '#3b82f6'}
                  onChange={(e) => onColorChange?.(e.target.value)}
                />
                <div className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/50 hover:border-foreground/50 flex items-center justify-center pointer-events-none">
                  <span className="text-[9px] text-muted-foreground leading-none">+</span>
                </div>
              </div>
              {/* Reset color */}
              <button
                className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/50 hover:border-destructive/60 hover:text-destructive transition-colors flex items-center justify-center text-muted-foreground text-[10px] font-medium"
                onClick={(e) => { e.stopPropagation(); onColorChange?.('') }}
                onPointerDown={(e) => e.stopPropagation()}
                title="Reset color"
              >
                ×
              </button>
            </div>

            <DropdownMenuSeparator />

            {connectionKey && (
              <>
                <DropdownMenuItem onClick={onNewKey}>
                  <FilePlus2 className="mr-2 h-3.5 w-3.5" />
                  New key
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={openMemoryTab}>
                  <BarChart2 className="mr-2 h-3.5 w-3.5" />
                  Memory analysis
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openSlowlogTab}>
                  <Clock className="mr-2 h-3.5 w-3.5" />
                  Slow log
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFlushConfirmOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <AlertTriangle className="mr-2 h-3.5 w-3.5" />
                  Flush DB
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete connection
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

      <AlertDialog open={flushConfirmOpen} onOpenChange={setFlushConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Flush all keys?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all keys in the current database. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onFlushDb}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Flush DB
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// Helper to get store actions without hooks (called in event handlers)
function useConnectionsStore_action() {
  // Direct state access — safe in event handlers
  return {
    addConnection: async (conn: Omit<import('@/types/connection').StoredConnection, 'key' | 'order'>) => {
      const { addConnection } = await import('@/store/connections').then((m) => m.useConnectionsStore.getState())
      return addConnection(conn)
    },
  }
}
