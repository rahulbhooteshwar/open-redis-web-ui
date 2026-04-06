'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  keySeparator: string
  maxKeys: number
  commandLogMaxLines: number
  zoomFactor: number
  setKeySeparator: (sep: string) => void
  setMaxKeys: (max: number) => void
  setCommandLogMaxLines: (max: number) => void
  setZoomFactor: (zoom: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      keySeparator: ':',
      maxKeys: 500,
      commandLogMaxLines: 2000,
      zoomFactor: 1.0,

      setKeySeparator: (keySeparator) => set({ keySeparator }),
      setMaxKeys: (maxKeys) => set({ maxKeys }),
      setCommandLogMaxLines: (commandLogMaxLines) => set({ commandLogMaxLines }),
      setZoomFactor: (zoomFactor) => set({ zoomFactor }),
    }),
    { name: 'orwui-settings' },
  ),
)
