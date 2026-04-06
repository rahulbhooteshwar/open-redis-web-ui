'use client'

import { create } from 'zustand'
import type { RedisClientProxy } from '@/lib/redis-client-proxy'

export type { RedisClientProxy }

interface ActiveConnectionEntry {
  connectionKey: string
  proxy: RedisClientProxy
  db: number
  configKey: string
}

interface ActiveConnectionsState {
  connections: Map<string, ActiveConnectionEntry>
  setConnection: (configKey: string, entry: ActiveConnectionEntry) => void
  removeConnection: (configKey: string) => void
  getConnection: (configKey: string) => ActiveConnectionEntry | undefined
  updateDb: (configKey: string, db: number) => void
}

export const useActiveConnectionsStore = create<ActiveConnectionsState>((set, get) => ({
  connections: new Map(),

  setConnection(configKey, entry) {
    set((s) => {
      const next = new Map(s.connections)
      next.set(configKey, entry)
      return { connections: next }
    })
  },

  removeConnection(configKey) {
    set((s) => {
      const next = new Map(s.connections)
      next.delete(configKey)
      return { connections: next }
    })
  },

  getConnection(configKey) {
    return get().connections.get(configKey)
  },

  updateDb(configKey, db) {
    set((s) => {
      const entry = s.connections.get(configKey)
      if (!entry) return s
      const next = new Map(s.connections)
      next.set(configKey, { ...entry, db })
      return { connections: next }
    })
  },
}))
