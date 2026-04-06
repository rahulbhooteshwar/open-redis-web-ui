'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Zap, Power, Loader2, AlertCircle } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
import { useActiveConnectionsStore } from '@/store/active-connections'
import { useConnectionsStore } from '@/store/connections'
import { useTabsStore } from '@/store/tabs'
import { connectViaServer, type RedisClientProxy } from '@/lib/redis-client-proxy'
import { type StoredConnection, getConnectionDisplayName } from '@/types/connection'
import { KeyBrowserPanel } from '@/components/key-browser/KeyBrowserPanel'
import { NewKeyDialog } from '@/components/key-browser/NewKeyDialog'
import { ConnectionHeader } from './ConnectionHeader'
import { NewConnectionDialog } from './NewConnectionDialog'
import { cn } from '@/lib/utils'

interface ConnectionItemProps {
  connection: StoredConnection
  index?: number
}

export function ConnectionItem({ connection, index = 0 }: ConnectionItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [newKeyOpen, setNewKeyOpen] = useState(false)
  const [flushTrigger, setFlushTrigger] = useState(0)

  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clientRef = useRef<RedisClientProxy | null>(null)

  const activeEntry = useActiveConnectionsStore((s) => s.getConnection(connection.key))
  const connectionKey = activeEntry?.connectionKey ?? null
  const isConnected = Boolean(connectionKey)

  const initialDb = connection.db ?? 0

  const startPing = useCallback(() => {
    if (pingTimerRef.current) clearInterval(pingTimerRef.current)
    pingTimerRef.current = setInterval(async () => {
      if (clientRef.current) {
        try {
          await clientRef.current.ping()
        } catch {/* ignore */}
      }
    }, 10_000)
  }, [])

  const stopPing = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current)
      pingTimerRef.current = null
    }
  }, [])

  const doConnect = useCallback(async () => {
    if (isConnected) return
    setIsConnecting(true)
    setError(null)

    try {
      const config: Record<string, unknown> = {
        host: connection.host,
        port: connection.port,
        password: connection.auth ?? connection.password,
        username: connection.username,
        db: initialDb,
        connectionName: getConnectionDisplayName(connection),
        name: connection.name,
        cluster: connection.cluster,
        natMap: connection.natMap,
        sshOptions: connection.sshOptions,
        sslOptions: connection.sslOptions,
        sentinelOptions: connection.sentinelOptions,
      }

      const client = await connectViaServer(config)
      clientRef.current = client

      useActiveConnectionsStore.getState().setConnection(connection.key, {
        connectionKey: client.connectionKey,
        proxy: client,
        db: initialDb,
        configKey: connection.key,
      })

      startPing()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setIsConnecting(false)
    }
  }, [connection, initialDb, isConnected, startPing])

  const doDisconnect = useCallback(async () => {
    stopPing()

    if (connectionKey) {
      try {
        await fetch('/api/redis/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: connectionKey }),
        })
      } catch {/* ignore */}

      useTabsStore.getState().closeConnectionTabs(connectionKey)
      useActiveConnectionsStore.getState().removeConnection(connection.key)
    }

    clientRef.current = null
    setError(null)
  }, [connection.key, connectionKey, stopPing])

  const handleOpenChange = useCallback(
    async (open: boolean) => {
      setIsOpen(open)
      if (open) {
        await doConnect()
      } else {
        await doDisconnect()
      }
    },
    [doConnect, doDisconnect],
  )

  const handleDelete = useCallback(() => {
    setDeleteConfirmOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    await doDisconnect()
    await useConnectionsStore.getState().deleteConnection(connection.key)
  }, [connection.key, doDisconnect])

  const handleFlushDb = useCallback(async () => {
    if (!clientRef.current) return
    try {
      await clientRef.current.flushdb()
      setFlushTrigger((n) => n + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Flush failed')
    }
  }, [])

  const handleColorChange = useCallback(
    async (color: string) => {
      await useConnectionsStore.getState().updateConnection(connection.key, { color: color || undefined })
    },
    [connection.key],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPing()
    }
  }, [stopPing])

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
        <div className="group">
          <div className={cn(
            'flex items-center rounded-sm mx-2 transition-colors group',
            index % 2 === 0 ? 'bg-sidebar-accent/30' : 'bg-muted/25',
          )}>
            <CollapsibleTrigger asChild>
              <button
                className="flex-shrink-0 p-2.5 rounded-sm hover:bg-sidebar-accent/60 transition-colors"
                aria-label={isOpen ? 'Collapse connection' : 'Expand connection'}
              >

                {
                  isOpen && <Zap
                    strokeWidth={3}
                    className={cn(
                      'h-5 w-5 text-sidebar-foreground transition-transform duration-200 text-green-400',
                    )}
                  />
                }
                {
                  !isOpen && <Power
                    strokeWidth={3}
                    className={cn(
                      'h-5 w-5 text-sidebar-foreground transition-transform duration-200'
                    )}
                  />
                }


              </button>
            </CollapsibleTrigger>
            <div className="flex-1 min-w-0">
              <ConnectionHeader
                connection={connection}
                connectionKey={connectionKey}
                isConnected={isConnected}
                onEdit={() => setEditOpen(true)}
                onDelete={handleDelete}
                onFlushDb={handleFlushDb}
                onNewKey={() => setNewKeyOpen(true)}
                onColorChange={handleColorChange}
              />
            </div>
            {isConnecting && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mr-1 flex-shrink-0" />
            )}
          </div>

          <CollapsibleContent>
            <div className="mx-2 mb-2 mt-0.5 rounded border border-border/60 bg-muted/30 dark:bg-black/20 overflow-hidden">
              <div className="p-1.5">
                {error && (
                  <div className="flex items-start gap-1.5 text-destructive text-[13px] py-1 px-2 rounded bg-destructive/10 mb-2">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span className="break-all">{error}</span>
                  </div>
                )}

                {isConnected && connectionKey && (
                  <KeyBrowserPanel
                    configKey={connection.key}
                    connectionKey={connectionKey}
                    db={initialDb}
                    onNewKey={() => setNewKeyOpen(true)}
                    refreshTrigger={flushTrigger}
                  />
                )}

                {isConnecting && !isConnected && (
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[13px] py-2 px-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Connecting...
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <NewConnectionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editingConnection={connection}
      />

      {connectionKey && (
        <NewKeyDialog
          open={newKeyOpen}
          onOpenChange={setNewKeyOpen}
          connectionKey={connectionKey}
          onCreated={() => { setNewKeyOpen(false); setFlushTrigger((n) => n + 1) }}
        />
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete connection?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{getConnectionDisplayName(connection)}&rdquo; will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
