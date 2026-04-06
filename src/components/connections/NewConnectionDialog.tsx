'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, Smile } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useConnectionsStore } from '@/store/connections'
import { type StoredConnection } from '@/types/connection'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// PasswordInput
// ---------------------------------------------------------------------------

function PasswordInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-8 text-sm"
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Color swatches
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
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

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  name: string
  host: string
  port: string
  password: string
  username: string
  db: string
  separator: string
  color: string
  emoji: string
  cluster: boolean
  // SSH
  sshHost: string
  sshPort: string
  sshUsername: string
  sshPassword: string
  sshPrivateKey: string
  sshPassphrase: string
  sshTimeout: string
  // SSL
  sslCa: string
  sslKey: string
  sslCert: string
  sslServername: string
  // Sentinel
  sentinelMasterName: string
  sentinelNodePassword: string
}

function defaultForm(conn?: StoredConnection): FormState {
  return {
    name: conn?.name ?? conn?.connectionName ?? '',
    host: conn?.host ?? 'localhost',
    port: String(conn?.port ?? 6379),
    password: conn?.auth ?? conn?.password ?? '',
    username: conn?.username ?? '',
    db: String(conn?.db ?? 0),
    separator: (conn as unknown as Record<string, unknown>)?.separator as string ?? ':',
    color: conn?.color ?? '',
    emoji: conn?.emoji ?? '',
    cluster: conn?.cluster ?? false,
    sshHost: conn?.sshOptions?.host ?? '',
    sshPort: String(conn?.sshOptions?.port ?? 22),
    sshUsername: conn?.sshOptions?.username ?? '',
    sshPassword: conn?.sshOptions?.password ?? '',
    sshPrivateKey: conn?.sshOptions?.privatekey ?? '',
    sshPassphrase: conn?.sshOptions?.passphrase ?? '',
    sshTimeout: String(conn?.sshOptions?.timeout ?? 30),
    sslCa: conn?.sslOptions?.ca ?? '',
    sslKey: conn?.sslOptions?.key ?? '',
    sslCert: conn?.sslOptions?.cert ?? '',
    sslServername: conn?.sslOptions?.servername ?? '',
    sentinelMasterName: conn?.sentinelOptions?.masterName ?? '',
    sentinelNodePassword: conn?.sentinelOptions?.nodePassword ?? '',
  }
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

interface NewConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingConnection?: StoredConnection
}

export function NewConnectionDialog({
  open,
  onOpenChange,
  editingConnection,
}: NewConnectionDialogProps) {
  const [form, setForm] = useState<FormState>(() => defaultForm(editingConnection))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(defaultForm(editingConnection))
      setError(null)
    }
  }, [open, editingConnection])

  const set = (key: keyof FormState, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const buildConfig = (): Omit<StoredConnection, 'key' | 'order'> => {
    const config: Omit<StoredConnection, 'key' | 'order'> = {
      name: form.name || undefined,
      connectionName: form.name || `${form.host}:${form.port}`,
      host: form.host,
      port: parseInt(form.port, 10) || 6379,
      password: form.password || undefined,
      username: form.username || undefined,
      db: parseInt(form.db, 10) || 0,
      cluster: form.cluster,
      color: form.color || undefined,
      emoji: form.emoji || undefined,
    }

    if (form.sshHost) {
      config.sshOptions = {
        host: form.sshHost,
        port: parseInt(form.sshPort, 10) || 22,
        username: form.sshUsername,
        password: form.sshPassword || undefined,
        privatekey: form.sshPrivateKey || undefined,
        passphrase: form.sshPassphrase || undefined,
        timeout: parseInt(form.sshTimeout, 10) || 30,
      }
    }

    if (form.sslCa || form.sslKey || form.sslCert) {
      config.sslOptions = {
        ca: form.sslCa || undefined,
        key: form.sslKey || undefined,
        cert: form.sslCert || undefined,
        servername: form.sslServername || undefined,
      }
    }

    if (form.sentinelMasterName) {
      config.sentinelOptions = {
        masterName: form.sentinelMasterName,
        nodePassword: form.sentinelNodePassword || undefined,
      }
    }

    return config
  }

  const handleSubmit = async () => {
    if (!form.host) {
      setError('Host is required')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const config = buildConfig()

      if (editingConnection) {
        await useConnectionsStore.getState().updateConnection(editingConnection.key, config)
      } else {
        await useConnectionsStore.getState().addConnection(config)
      }
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save connection')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTest = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const config = buildConfig()
      const res = await fetch('/api/redis/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.message ?? 'Connection test failed')
      } else {
        setError(null)
        toast.success('Connection successful!')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingConnection ? 'Edit Connection' : 'New Connection'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic">
          <TabsList className="grid w-full grid-cols-5 h-8">
            <TabsTrigger value="basic" className="text-xs">Basic</TabsTrigger>
            <TabsTrigger value="ssh" className="text-xs">SSH</TabsTrigger>
            <TabsTrigger value="ssl" className="text-xs">SSL</TabsTrigger>
            <TabsTrigger value="sentinel" className="text-xs">Sentinel</TabsTrigger>
            <TabsTrigger value="cluster" className="text-xs">Cluster</TabsTrigger>
          </TabsList>

          {/* ─── Basic tab ─────────────────────────────────────────────── */}
          <TabsContent value="basic" className="space-y-3 mt-3">
            <FormRow label="Name" id="name">
              <Input
                id="name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="My Redis"
                className="text-sm"
              />
            </FormRow>

            <div className="grid grid-cols-3 gap-2">
              <FormRow label="Host" id="host" className="col-span-2">
                <Input
                  id="host"
                  value={form.host}
                  onChange={(e) => set('host', e.target.value)}
                  placeholder="localhost"
                  className="text-sm"
                />
              </FormRow>
              <FormRow label="Port" id="port">
                <Input
                  id="port"
                  type="number"
                  value={form.port}
                  onChange={(e) => set('port', e.target.value)}
                  placeholder="6379"
                  className="text-sm"
                />
              </FormRow>
            </div>

            <FormRow label="Password" id="password">
              <PasswordInput
                id="password"
                value={form.password}
                onChange={(v) => set('password', v)}
                placeholder="(optional)"
              />
            </FormRow>

            <FormRow label="Username" id="username">
              <Input
                id="username"
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
                placeholder="(optional, Redis 6+ ACL)"
                className="text-sm"
              />
            </FormRow>

            <div className="grid grid-cols-2 gap-2">
              <FormRow label="DB Index" id="db">
                <Input
                  id="db"
                  type="number"
                  value={form.db}
                  onChange={(e) => set('db', e.target.value)}
                  placeholder="0"
                  className="text-sm"
                />
              </FormRow>
              <FormRow label="Key Separator" id="separator">
                <Input
                  id="separator"
                  value={form.separator}
                  onChange={(e) => set('separator', e.target.value)}
                  placeholder=":"
                  className="text-sm"
                />
              </FormRow>
            </div>

            {/* Color swatches */}
            <div className="space-y-1.5">
              <Label className="text-xs">Color</Label>
              <div className="grid grid-cols-8 gap-1.5 items-center">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      'w-6 h-6 rounded-full border-2 transition-all hover:scale-110',
                      form.color === c
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:border-foreground/40',
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => set('color', form.color === c ? '' : c)}
                  />
                ))}
                {/* Custom color picker */}
                <label
                  className={cn(
                    'w-6 h-6 rounded-full border-2 cursor-pointer relative flex items-center justify-center transition-all hover:scale-110',
                    form.color && !PRESET_COLORS.includes(form.color)
                      ? 'border-foreground scale-110'
                      : 'border-dashed border-muted-foreground/50 hover:border-foreground/40',
                  )}
                  style={form.color && !PRESET_COLORS.includes(form.color) ? { backgroundColor: form.color } : undefined}
                  title="Custom color"
                >
                  <input
                    type="color"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    value={form.color && !PRESET_COLORS.includes(form.color) ? form.color : '#3b82f6'}
                    onChange={(e) => set('color', e.target.value)}
                  />
                  {(!form.color || PRESET_COLORS.includes(form.color)) && (
                    <span className="text-[9px] text-muted-foreground leading-none pointer-events-none">+</span>
                  )}
                </label>
                {/* Reset */}
                {form.color && (
                  <button
                    type="button"
                    className="w-6 h-6 rounded-full border border-dashed border-muted-foreground/50 hover:border-destructive/60 hover:text-destructive transition-colors flex items-center justify-center text-muted-foreground text-[11px] font-medium"
                    onClick={() => set('color', '')}
                    title="Clear color"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Emoji picker */}
            <div className="space-y-1.5">
              <Label className="text-xs">Emoji</Label>
              <div className="flex items-center gap-2">
                <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                      {form.emoji ? (
                        <span className="text-base">{form.emoji}</span>
                      ) : (
                        <Smile className="h-3.5 w-3.5" />
                      )}
                      {form.emoji ? form.emoji : 'Pick emoji'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-auto" align="start">
                    <EmojiPicker
                      onSelect={(emoji: string) => {
                        set('emoji', emoji)
                        setEmojiOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {form.emoji && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => set('emoji', '')}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ─── SSH tab ────────────────────────────────────────────────── */}
          <TabsContent value="ssh" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">Connect via SSH tunnel.</p>
            <FormRow label="SSH Host" id="sshHost">
              <Input
                id="sshHost"
                value={form.sshHost}
                onChange={(e) => set('sshHost', e.target.value)}
                placeholder="ssh.example.com"
                className="text-sm"
              />
            </FormRow>
            <div className="grid grid-cols-3 gap-2">
              <FormRow label="SSH Port" id="sshPort" className="col-span-1">
                <Input
                  id="sshPort"
                  type="number"
                  value={form.sshPort}
                  onChange={(e) => set('sshPort', e.target.value)}
                  placeholder="22"
                  className="text-sm"
                />
              </FormRow>
              <FormRow label="Timeout (s)" id="sshTimeout" className="col-span-1">
                <Input
                  id="sshTimeout"
                  type="number"
                  value={form.sshTimeout}
                  onChange={(e) => set('sshTimeout', e.target.value)}
                  placeholder="30"
                  className="text-sm"
                />
              </FormRow>
            </div>
            <FormRow label="SSH Username" id="sshUsername">
              <Input
                id="sshUsername"
                value={form.sshUsername}
                onChange={(e) => set('sshUsername', e.target.value)}
                placeholder="ubuntu"
                className="text-sm"
              />
            </FormRow>
            <FormRow label="SSH Password" id="sshPassword">
              <PasswordInput
                id="sshPassword"
                value={form.sshPassword}
                onChange={(v) => set('sshPassword', v)}
                placeholder="(optional if using private key)"
              />
            </FormRow>
            <FormRow label="Private Key" id="sshPrivateKey">
              <textarea
                id="sshPrivateKey"
                value={form.sshPrivateKey}
                onChange={(e) => set('sshPrivateKey', e.target.value)}
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..."
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </FormRow>
            <FormRow label="Passphrase" id="sshPassphrase">
              <PasswordInput
                id="sshPassphrase"
                value={form.sshPassphrase}
                onChange={(v) => set('sshPassphrase', v)}
                placeholder="(optional)"
              />
            </FormRow>
          </TabsContent>

          {/* ─── SSL tab ─────────────────────────────────────────────────── */}
          <TabsContent value="ssl" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">TLS/SSL configuration.</p>
            <FormRow label="CA Certificate" id="sslCa">
              <textarea
                id="sslCa"
                value={form.sslCa}
                onChange={(e) => set('sslCa', e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </FormRow>
            <FormRow label="Client Certificate" id="sslCert">
              <textarea
                id="sslCert"
                value={form.sslCert}
                onChange={(e) => set('sslCert', e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </FormRow>
            <FormRow label="Client Key" id="sslKey">
              <textarea
                id="sslKey"
                value={form.sslKey}
                onChange={(e) => set('sslKey', e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </FormRow>
            <FormRow label="Server Name" id="sslServername">
              <Input
                id="sslServername"
                value={form.sslServername}
                onChange={(e) => set('sslServername', e.target.value)}
                placeholder="(SNI override, optional)"
                className="text-sm"
              />
            </FormRow>
          </TabsContent>

          {/* ─── Sentinel tab ────────────────────────────────────────────── */}
          <TabsContent value="sentinel" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">Redis Sentinel configuration.</p>
            <FormRow label="Master Name" id="sentinelMasterName">
              <Input
                id="sentinelMasterName"
                value={form.sentinelMasterName}
                onChange={(e) => set('sentinelMasterName', e.target.value)}
                placeholder="mymaster"
                className="text-sm"
              />
            </FormRow>
            <FormRow label="Node Password" id="sentinelNodePassword">
              <PasswordInput
                id="sentinelNodePassword"
                value={form.sentinelNodePassword}
                onChange={(v) => set('sentinelNodePassword', v)}
                placeholder="(optional)"
              />
            </FormRow>
          </TabsContent>

          {/* ─── Cluster tab ─────────────────────────────────────────────── */}
          <TabsContent value="cluster" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">Redis Cluster configuration.</p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="cluster"
                checked={form.cluster}
                onCheckedChange={(checked) => set('cluster', Boolean(checked))}
              />
              <Label htmlFor="cluster" className="text-sm">Enable cluster mode</Label>
            </div>
            {form.cluster && (
              <p className="text-xs text-muted-foreground">
                In cluster mode, the Host and Port above should point to any cluster node.
              </p>
            )}
          </TabsContent>
        </Tabs>

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive mt-2 px-1">{error}</p>
        )}

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={submitting}>
            Test Connection
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : editingConnection ? 'Save Changes' : 'Add Connection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FormRow({
  label,
  id,
  children,
  className,
}: {
  label: string
  id: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  )
}

function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  // Lazy-load emoji-mart to avoid SSR issues
  const [Picker, setPicker] = useState<React.ComponentType<{
    data: unknown
    onEmojiSelect: (e: { native: string }) => void
    theme: string
    previewPosition: string
    skinTonePosition: string
  }> | null>(null)
  const [data, setData] = useState<unknown>(null)

  useEffect(() => {
    Promise.all([
      import('@emoji-mart/react').then((m) => m.default),
      import('@emoji-mart/data').then((m) => m.default),
    ]).then(([PickerComp, emojiData]) => {
      setPicker(() => PickerComp as typeof Picker)
      setData(emojiData)
    })
  }, [])

  if (!Picker || !data) {
    return <div className="p-4 text-xs text-muted-foreground">Loading emojis...</div>
  }

  return (
    <Picker
      data={data}
      onEmojiSelect={(e: { native: string }) => onSelect(e.native)}
      theme="auto"
      previewPosition="none"
      skinTonePosition="none"
    />
  )
}
