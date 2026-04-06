'use client'

import { useEffect, useState } from 'react'
import { MonacoEditor } from '@/components/shared/MonacoEditor'

async function decompress(value: Uint8Array): Promise<string> {
  const ds = new DecompressionStream('deflate')
  const writer = ds.writable.getWriter()
  const reader = ds.readable.getReader()

  writer.write(value as unknown as Uint8Array<ArrayBuffer>)
  writer.close()

  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value: chunk } = await reader.read()
    if (done) break
    chunks.push(chunk)
  }

  const total = chunks.reduce((acc, c) => acc + c.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }

  return new TextDecoder('utf-8').decode(merged)
}

export function ViewerDeflate({ value }: { value: Uint8Array }) {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setText(null)

    decompress(value)
      .then((result) => setText(result))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [value])

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
        Decompressing…
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full w-full p-3">
        <div className="px-3 py-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded">
          Deflate decompression failed: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <MonacoEditor value={text ?? ''} language="plaintext" readOnly />
    </div>
  )
}
