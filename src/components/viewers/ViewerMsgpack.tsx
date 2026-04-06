'use client'

import { useMemo } from 'react'
import { decode } from 'algo-msgpack-with-bigint'
import { MonacoEditor } from '@/components/shared/MonacoEditor'

export function ViewerMsgpack({ value }: { value: Uint8Array }) {
  const { text, error } = useMemo(() => {
    try {
      const decoded = decode(value)
      return { text: JSON.stringify(decoded, null, 2), error: null }
    } catch (e) {
      return { text: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [value])

  if (error) {
    return (
      <div className="h-full w-full p-3">
        <div className="px-3 py-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded">
          Msgpack decode failed: {error}
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
