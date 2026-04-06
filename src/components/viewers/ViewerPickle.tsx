'use client'

import { useMemo } from 'react'
import { Parser } from 'pickleparser'
import { MonacoEditor } from '@/components/shared/MonacoEditor'

export function ViewerPickle({ value }: { value: Uint8Array }) {
  const { text, error } = useMemo(() => {
    try {
      const parser = new Parser()
      const decoded = parser.parse(Buffer.from(value))
      return { text: JSON.stringify(decoded, null, 2), error: null }
    } catch (e) {
      return { text: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [value])

  if (error) {
    return (
      <div className="h-full w-full p-3">
        <div className="px-3 py-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded">
          Python pickle decode failed: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <MonacoEditor value={text ?? ''} language="json" readOnly />
    </div>
  )
}
