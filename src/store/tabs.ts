'use client'

import { create } from 'zustand'
import type { Tab } from '@/types/tab'

interface TabsState {
  tabs: Tab[]
  selectedTabId: string | null
  addTab: (tab: Tab) => void
  closeTab: (id: string) => void
  closeOtherTabs: (id: string) => void
  closeTabsToRight: (id: string) => void
  closeTabsToLeft: (id: string) => void
  selectTab: (id: string) => void
  closeConnectionTabs: (connectionKey: string) => void
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  selectedTabId: null,

  addTab(tab) {
    const { tabs } = get()
    // Don't duplicate: for key tabs check connectionKey + redisKey, for others check type + connectionKey
    const existing = tabs.find((t) => {
      if (t.type === 'key' && tab.type === 'key') {
        return t.connectionKey === tab.connectionKey && t.redisKey === tab.redisKey
      }
      return t.type === tab.type && t.connectionKey === tab.connectionKey
    })
    if (existing) {
      set({ selectedTabId: existing.id })
      return
    }
    set((s) => ({ tabs: [...s.tabs, tab], selectedTabId: tab.id }))
  },

  closeTab(id) {
    const { tabs, selectedTabId } = get()
    const idx = tabs.findIndex((t) => t.id === id)
    const newTabs = tabs.filter((t) => t.id !== id)

    let newSelected = selectedTabId
    if (selectedTabId === id) {
      // Select adjacent tab
      const next = newTabs[idx] || newTabs[idx - 1] || null
      newSelected = next?.id ?? null
    }
    set({ tabs: newTabs, selectedTabId: newSelected })
  },

  closeOtherTabs(id) {
    const { tabs } = get()
    const tab = tabs.find((t) => t.id === id)
    if (!tab) return
    set({ tabs: [tab], selectedTabId: id })
  },

  closeTabsToRight(id) {
    const { tabs } = get()
    const idx = tabs.findIndex((t) => t.id === id)
    const newTabs = tabs.slice(0, idx + 1)
    const { selectedTabId } = get()
    set({
      tabs: newTabs,
      selectedTabId: newTabs.find((t) => t.id === selectedTabId) ? selectedTabId : id,
    })
  },

  closeTabsToLeft(id) {
    const { tabs } = get()
    const idx = tabs.findIndex((t) => t.id === id)
    const newTabs = tabs.slice(idx)
    const { selectedTabId } = get()
    set({
      tabs: newTabs,
      selectedTabId: newTabs.find((t) => t.id === selectedTabId) ? selectedTabId : id,
    })
  },

  selectTab(id) {
    set({ selectedTabId: id })
  },

  closeConnectionTabs(connectionKey) {
    const { tabs, selectedTabId } = get()
    const newTabs = tabs.filter((t) => t.connectionKey !== connectionKey)
    const newSelected = newTabs.find((t) => t.id === selectedTabId) ? selectedTabId : newTabs[newTabs.length - 1]?.id ?? null
    set({ tabs: newTabs, selectedTabId: newSelected })
  },
}))
