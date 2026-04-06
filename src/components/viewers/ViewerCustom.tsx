'use client'

import { useState, useEffect, useCallback } from 'react'
import { MonacoEditor } from '@/components/shared/MonacoEditor'

const STORAGE_KEY = 'orwui-custom-formatter'

const DEFAULT_FUNCTION = `function transform(value) {
  // value is a Uint8Array
  // Return a string to display
  return new TextDecoder().decode(value)
}`

export function ViewerCustom({ value }: { value: Uint8Array }) {
  const [fnSource, setFnSource] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_FUNCTION
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_FUNCTION
  })
  const [output, setOutput] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const runTransform = useCallback(
    (source: string, buf: Uint8Array) => {
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(`return (${source})`)() as (v: Uint8Array) => string
        if (typeof fn !== 'function') throw new Error('Expression did not return a function')
        const result = fn(buf)
        if (typeof result !== 'string') throw new Error(`transform() must return a string, got ${typeof result}`)
        setOutput(result)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setOutput('')
      }
    },
    [],
  )

  useEffect(() => {
    runTransform(fnSource, value)
  }, [fnSource, value, runTransform])

  function handleFnChange(newSource: string) {
    setFnSource(newSource)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newSource)
    }
  }

  return (
    <div className="h-full w-full flex flex-col gap-2">
      {/* Transform function editor */}
      <div className="shrink-0 flex flex-col gap-1">
        <div className="text-xs text-muted-foreground px-1">
          Custom transform function (stored in localStorage)
        </div>
        <div className="h-32 border border-border rounded overflow-hidden">
          <MonacoEditor
            value={fnSource}
            language="javascript"
            readOnly={false}
            onChange={handleFnChange}
            height="100%"
          />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-3 py-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded shrink-0">
          Error: {error}
        </div>
      )}

      {/* Output */}
      {!error && (
        <div className="flex-1 min-h-0 border border-border rounded overflow-hidden">
          <MonacoEditor value={output} language="plaintext" readOnly height="100%" />
        </div>
      )}
    </div>
  )
}
