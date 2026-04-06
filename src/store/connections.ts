'use client'

import { create } from 'zustand'
import type { StoredConnection } from '@/types/connection'

interface ConnectionsState {
  connections: StoredConnection[]
  loading: boolean
  fetchConnections: () => Promise<void>
  addConnection: (conn: Omit<StoredConnection, 'key' | 'order'>) => Promise<StoredConnection>
  updateConnection: (key: string, updates: Partial<StoredConnection>) => Promise<void>
  deleteConnection: (key: string) => Promise<void>
  reorderConnections: (connections: StoredConnection[]) => Promise<void>
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  connections: [],
  loading: false,

  async fetchConnections() {
    set({ loading: true })
    try {
      const res = await fetch('/api/connections')
      const list = await res.json()
      set({ connections: list, loading: false })
    } catch (e) {
      set({ loading: false })
    }
  },

  async addConnection(conn) {
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conn),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || 'Failed to create connection')
    }
    const created: StoredConnection = await res.json()
    set((s) => ({ connections: [...s.connections, created] }))
    return created
  },

  async updateConnection(key, updates) {
    const res = await fetch(`/api/connections/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates, (_k, v) => (v === undefined ? null : v)),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || 'Failed to update connection')
    }
    const updated: StoredConnection = await res.json()
    set((s) => ({
      connections: s.connections.map((c) => (c.key === key ? updated : c)),
    }))
  },

  async deleteConnection(key) {
    await fetch(`/api/connections/${key}`, { method: 'DELETE' })
    set((s) => ({ connections: s.connections.filter((c) => c.key !== key) }))
  },

  async reorderConnections(connections) {
    set({ connections })
    await fetch('/api/connections/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(connections),
    })
  },
}))
