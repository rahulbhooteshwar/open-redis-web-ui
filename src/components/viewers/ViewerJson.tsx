'use client'

import { useState, useEffect } from 'react'
import { MonacoEditor } from '@/components/shared/MonacoEditor'

interface ViewerProps {
  value: Uint8Array
  readOnly?: boolean
  onChange?: (newValue: Uint8Array) => void
}

function prettyJson(str: string): { result: string; error: string | null } {
  try {
    const parsed = JSON.parse(str)
    return { result: JSON.stringify(parsed, null, 2), error: null }
  } catch (e) {
    return { result: str, error: e instanceof Error ? e.message : String(e) }
  }
}

export function ViewerJson({ value, readOnly = true, onChange }: ViewerProps) {
  const raw = new TextDecoder('utf-8').decode(value)
  const { result: initialPretty, error: initialError } = prettyJson(raw)

  const [editorValue, setEditorValue] = useState(initialPretty)
  const [parseError, setParseError] = useState<string | null>(initialError)

  useEffect(() => {
    const decoded = new TextDecoder('utf-8').decode(value)
    const { result, error } = prettyJson(decoded)
    setEditorValue(result)
    setParseError(error)
  }, [value])

  function handleChange(newStr: string) {
    setEditorValue(newStr)
    try {
      JSON.parse(newStr)
      setParseError(null)
      onChange?.(new TextEncoder().encode(newStr))
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="h-full w-full flex flex-col gap-1">
      {parseError && (
        <div className="px-3 py-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded shrink-0">
          Invalid JSON: {parseError}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <MonacoEditor
          value={editorValue}
          language="json"
          readOnly={readOnly}
          onChange={readOnly ? undefined : handleChange}
        />
      </div>
    </div>
  )
}
