'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { FileDown, FileUp, Minus, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSettingsStore } from '@/store/settings'
import { useConnectionsStore } from '@/store/connections'
import { toast } from 'sonner'
import type { StoredConnection } from '@/types/connection'

// ---------------------------------------------------------------------------
// Stepper input with +/- buttons
// ---------------------------------------------------------------------------

interface StepperProps {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  precision?: number
  width?: string
}

function Stepper({ value, onChange, min, max, step, precision = 0, width = 'w-40' }: StepperProps) {
  const fmt = (v: number) => precision > 0 ? v.toFixed(precision) : String(v)

  function clamp(v: number) {
    return Math.min(max, Math.max(min, v))
  }

  return (
    <div className={`flex items-center h-8 rounded-md border border-input overflow-hidden ${width}`}>
      <button
        type="button"
        className="px-2 h-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
        onClick={() => onChange(clamp(parseFloat((value - step).toFixed(10))))}
        disabled={value <= min}
      >
        <Minus className="h-3 w-3" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        className="flex-1 min-w-0 text-center text-sm bg-transparent focus:outline-none"
        value={fmt(value)}
        onChange={(e) => {
          const n = parseFloat(e.target.value)
          if (!isNaN(n)) onChange(clamp(n))
        }}
      />
      <button
        type="button"
        className="px-2 h-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
        onClick={() => onChange(clamp(parseFloat((value + step).toFixed(10))))}
        disabled={value >= max}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border">
      <div className="px-4 py-2.5 border-b border-border">
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-8 gap-y-4">{children}</div>
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        {label}
        {hint && (
          <span className="text-muted-foreground/50 cursor-help" title={hint}>?</span>
        )}
      </Label>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme()
  const store = useSettingsStore()
  const { fetchConnections, addConnection, deleteConnection } = useConnectionsStore()

  const [draft, setDraft] = useState({
    maxKeys: store.maxKeys,
    zoomFactor: store.zoomFactor,
  })
  const [draftTheme, setDraftTheme] = useState<string>(theme ?? 'system')
  const [importPending, setImportPending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync draft when dialog opens
  useEffect(() => {
    if (!open) return
    setDraft({
      maxKeys: store.maxKeys,
      zoomFactor: store.zoomFactor,
    })
    setDraftTheme(theme ?? 'system')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    store.setMaxKeys(draft.maxKeys)
    store.setZoomFactor(draft.zoomFactor)
    setTheme(draftTheme)
    document.documentElement.style.zoom = String(draft.zoomFactor)
    onOpenChange(false)
    toast.success('Settings saved')
  }

  // ---- Export ----
  async function handleExport() {
    await fetchConnections()
    const data = useConnectionsStore.getState().connections
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))))
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([b64], { type: 'text/plain' })),
      download: 'connections.ano',
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // ---- Import ----
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportPending(true)
    try {
      const text = await file.text()
      let json: string
      try { json = decodeURIComponent(escape(atob(text.trim()))) } catch { json = text }
      const imported: StoredConnection[] = JSON.parse(json)
      if (!Array.isArray(imported)) throw new Error('Invalid format')

      // Strip legacy absolute paths
      const isAbsPath = (v: string | undefined) =>
        typeof v === 'string' && (v.startsWith('/') || /^[A-Za-z]:\\/.test(v))
      const warned: string[] = []
      for (const conn of imported) {
        if (conn.sshOptions?.privatekey && isAbsPath(conn.sshOptions.privatekey)) {
          conn.sshOptions.privatekey = ''
          warned.push(conn.name || conn.host)
        }
        if (conn.sslOptions) {
          for (const f of ['key', 'cert', 'ca'] as const) {
            if (isAbsPath(conn.sslOptions[f])) {
              conn.sslOptions[f] = ''
              if (!warned.includes(conn.name || conn.host)) warned.push(conn.name || conn.host)
            }
          }
        }
      }
      if (warned.length) {
        toast.warning(`Legacy key paths cleared for: ${warned.join(', ')}`, { duration: 6000 })
      }

      await fetchConnections()
      for (const c of useConnectionsStore.getState().connections) await deleteConnection(c.key)
      for (const { key: _k, order: _o, ...conn } of imported) {
        await addConnection(conn as Omit<StoredConnection, 'key' | 'order'>)
      }
      await fetchConnections()
      toast.success('Connections imported successfully')
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setImportPending(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {/* Appearance */}
          <Section title="Appearance">
            <FieldGrid>
              <Field label="Color Theme">
                <Select value={draftTheme} onValueChange={setDraftTheme}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Page Zoom" hint="Scales the entire UI (0.5 – 2.0)">
                <Stepper
                  value={draft.zoomFactor}
                  onChange={(v) => setDraft((d) => ({ ...d, zoomFactor: v }))}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  precision={1}
                />
              </Field>

            </FieldGrid>
          </Section>

          {/* General */}
          <Section title="General">
            <FieldGrid>
              <Field label="Load Number" hint="Keys to scan per page (10 – 20 000)">
                <Stepper
                  value={draft.maxKeys}
                  onChange={(v) => setDraft((d) => ({ ...d, maxKeys: v }))}
                  min={10}
                  max={20000}
                  step={50}
                />
              </Field>

              <Field label="Connections">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8" onClick={handleExport}>
                    <FileDown />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importPending}
                  >
                    <FileUp />
                    {importPending ? 'Importing…' : 'Import'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ano,.json,.txt"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </Field>
            </FieldGrid>
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
