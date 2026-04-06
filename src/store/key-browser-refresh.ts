import { create } from 'zustand'

interface KeyBrowserRefreshState {
  refreshCounts: Record<string, number>
  bumpRefresh: (connectionKey: string) => void
}

export const useKeyBrowserRefreshStore = create<KeyBrowserRefreshState>((set) => ({
  refreshCounts: {},
  bumpRefresh(connectionKey) {
    set((s) => ({
      refreshCounts: {
        ...s.refreshCounts,
        [connectionKey]: (s.refreshCounts[connectionKey] ?? 0) + 1,
      },
    }))
  },
}))
