'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Edit2, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MonacoEditor } from '@/components/shared/MonacoEditor'

interface Props {
  connectionKey: string
  keyName: string
}

export function KeyContentReJson({ connectionKey, keyName }: Props) {
  const [raw, setRaw] = useState('')
  const [edited, setEdited] = useState('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/redis/${connectionKey}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'JSON.GET', args: [keyName, '$'] }),
      })
      const data = await res.json()
      const value = data.result ?? data.value ?? ''
      const formatted = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      // Redis returns JSON.GET result as a JSON array string like `[{...}]` — unwrap if single
      let pretty = formatted
      try {
        const parsed = JSON.parse(formatted)
        if (Array.isArray(parsed) && parsed.length === 1) {
          pretty = JSON.stringify(parsed[0], null, 2)
        } else {
          pretty = JSON.stringify(parsed, null, 2)
        }
      } catch { /* keep raw */ }
      setRaw(pretty)
      setEdited(pretty)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [connectionKey, keyName])

  const save = useCallback(async () => {
    try {
      JSON.parse(edited)
    } catch {
      setError('Invalid JSON')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/redis/${connectionKey}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'JSON.SET', args: [keyName, '$', edited] }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.message)
      setRaw(edited)
      setEditing(false)
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }, [connectionKey, keyName, edited])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="text-xs text-muted-foreground font-mono">{keyName}</span>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              {error && <span className="text-xs text-destructive mr-2">{error}</span>}
              <Button variant="ghost" size="sm" onClick={() => { setEdited(raw); setEditing(false); setError('') }}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                <Check className="h-3.5 w-3.5 mr-1" /> {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
            </>
          )}
        </div>
      </div>

      {!editing && error && (
        <div className="px-3 py-2 text-xs text-destructive">{error}</div>
      )}

      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          value={editing ? edited : raw}
          onChange={editing ? setEdited : undefined}
          language="json"
          readOnly={!editing}
        />
      </div>
    </div>
  )
}
