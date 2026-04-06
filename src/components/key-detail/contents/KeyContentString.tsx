'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormatViewer } from '@/components/viewers/FormatViewer'

interface Props {
  connectionKey: string
  keyName: string
}

export function KeyContentString({ connectionKey, keyName }: Props) {
  const [value, setValue] = useState<Uint8Array>(new Uint8Array())
  const [editValue, setEditValue] = useState<Uint8Array>(new Uint8Array())
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchValue = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/keys/${connectionKey}/get?keyName=${encodeURIComponent(keyName)}&type=string`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const str: string = data.value ?? ''
      const bytes = new TextEncoder().encode(str)
      setValue(bytes)
      setEditValue(bytes)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }, [connectionKey, keyName])

  useEffect(() => {
    fetchValue()
  }, [fetchValue])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const str = new TextDecoder('utf-8').decode(editValue)
      const res = await fetch(`/api/keys/${connectionKey}/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName, value: str, type: 'string' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setValue(editValue)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setSaving(false)
  }, [connectionKey, keyName, editValue])

  const handleCancelEdit = useCallback(() => {
    setEditValue(value)
    setEditing(false)
  }, [value])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Loading…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/10 shrink-0">
        <span className="text-xs text-muted-foreground flex-1">
          {value.length.toLocaleString()} bytes
        </span>
        {error && (
          <span className="text-xs text-destructive">{error}</span>
        )}
        {editing ? (
          <>
            <Button
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs gap-1"
              onClick={handleCancelEdit}
              disabled={saving}
            >
              <X className="h-3 w-3" />
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => { setEditing(true); setEditValue(value) }}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        )}
      </div>

      {/* Viewer */}
      <div className="flex-1 min-h-0">
        <FormatViewer
          value={editing ? editValue : value}
          readOnly={!editing}
          onChange={editing ? setEditValue : undefined}
        />
      </div>
    </div>
  )
}
