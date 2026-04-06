'use client'

import { useMemo } from 'react'
import { MonacoEditor } from '@/components/shared/MonacoEditor'

export function ViewerJavaSerialize({ value }: { value: Uint8Array }) {
  const { text, error } = useMemo(() => {
    try {
      // java-object-serialization exports ObjectInputStream
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ObjectInputStream } = require('java-object-serialization')
      const stream = new ObjectInputStream(Buffer.from(value))
      const decoded = stream.readObject()
      return { text: JSON.stringify(decoded, null, 2), error: null }
    } catch (e) {
      return { text: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [value])

  if (error) {
    return (
      <div className="h-full w-full p-3">
        <div className="px-3 py-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded">
          Java deserialization failed: {error}
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
