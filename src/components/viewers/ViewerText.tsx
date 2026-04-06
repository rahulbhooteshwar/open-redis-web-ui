'use client'

import { MonacoEditor } from '@/components/shared/MonacoEditor'

interface ViewerProps {
  value: Uint8Array
  readOnly?: boolean
  onChange?: (newValue: Uint8Array) => void
}

export function ViewerText({ value, readOnly = true, onChange }: ViewerProps) {
  const text = new TextDecoder('utf-8').decode(value)

  function handleChange(newStr: string) {
    onChange?.(new TextEncoder().encode(newStr))
  }

  return (
    <div className="h-full w-full">
      <MonacoEditor
        value={text}
        language="plaintext"
        readOnly={readOnly}
        onChange={readOnly ? undefined : handleChange}
      />
    </div>
  )
}
