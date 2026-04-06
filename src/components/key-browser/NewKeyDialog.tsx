'use client'

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const KEY_TYPES = ['string', 'hash', 'list', 'set', 'zset'] as const
type KeyType = (typeof KEY_TYPES)[number]

const TYPE_DEFAULTS: Record<KeyType, string> = {
  string: '',
  hash: '',
  list: '',
  set: '',
  zset: '',
}

const TYPE_HINTS: Record<KeyType, string> = {
  string: 'Initial string value',
  hash: 'Creates an empty hash — add fields after opening',
  list: 'Creates an empty list — add items after opening',
  set: 'Creates an empty set — add members after opening',
  zset: 'Creates an empty sorted set — add members after opening',
}

interface NewKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionKey: string
  onCreated: (keyName: string, keyType: string) => void
}

export function NewKeyDialog({ open, onOpenChange, connectionKey, onCreated }: NewKeyDialogProps) {
  const [keyName, setKeyName] = useState('')
  const [keyType, setKeyType] = useState<KeyType>('string')
  const [stringValue, setStringValue] = useState('')
  const [ttl, setTtl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setKeyName('')
    setKeyType('string')
    setStringValue('')
    setTtl('')
    setError(null)
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

  const handleCreate = useCallback(async () => {
    const name = keyName.trim()
    if (!name) { setError('Key name is required'); return }

    setSaving(true)
    setError(null)

    try {
      const body: Record<string, unknown> = { keyName: name, type: keyType }

      if (keyType === 'string') {
        body.value = stringValue
      } else {
        // For collection types, create with one placeholder entry so Redis stores the key
        body.value = keyType === 'hash'
          ? [['field1', 'value1']]
          : keyType === 'zset'
            ? [{ score: '0', member: 'member1' }]
            : ['item1']
      }

      const parsedTtl = parseInt(ttl, 10)
      if (!isNaN(parsedTtl) && parsedTtl > 0) body.ttl = parsedTtl

      const res = await fetch(`/api/keys/${connectionKey}/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to create key')
      }

      onCreated(name, keyType)
      handleOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create key')
    }
    setSaving(false)
  }, [keyName, keyType, stringValue, ttl, connectionKey, onCreated])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>New Key</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Key name */}
          <div className="space-y-1.5">
            <Label htmlFor="nk-name" className="text-xs">Key name</Label>
            <Input
              id="nk-name"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="e.g. user:1000:profile"
              className="font-mono text-sm"
              autoFocus
            />
          </div>

          {/* Key type */}
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={keyType} onValueChange={(v) => setKeyType(v as KeyType)}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KEY_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-sm capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{TYPE_HINTS[keyType]}</p>
          </div>

          {/* String value */}
          {keyType === 'string' && (
            <div className="space-y-1.5">
              <Label htmlFor="nk-value" className="text-xs">Value</Label>
              <Input
                id="nk-value"
                value={stringValue}
                onChange={(e) => setStringValue(e.target.value)}
                placeholder="Value"
                className="font-mono text-sm"
              />
            </div>
          )}

          {/* TTL */}
          <div className="space-y-1.5">
            <Label htmlFor="nk-ttl" className="text-xs">TTL (seconds, optional)</Label>
            <Input
              id="nk-ttl"
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
              placeholder="Leave blank for no expiry"
              className="font-mono text-sm"
              type="number"
              min={1}
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving || !keyName.trim()}>
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
