'use client'

const BINARY_DISPLAY_LIMIT = 256

export function ViewerBinary({ value }: { value: Uint8Array }) {
  const limit = Math.min(value.length, BINARY_DISPLAY_LIMIT)
  const truncated = value.length > BINARY_DISPLAY_LIMIT

  const bitsContent = Array.from(value.slice(0, limit))
    .map((byte) => byte.toString(2).padStart(8, '0'))
    .join(' ')

  return (
    <div className="h-full w-full flex flex-col gap-1">
      {truncated && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/40 border border-border rounded shrink-0">
          Showing first {BINARY_DISPLAY_LIMIT} of {value.length.toLocaleString()} bytes.
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        <pre className="font-mono text-xs p-3 whitespace-pre-wrap break-all leading-relaxed text-foreground">
          {bitsContent}
        </pre>
      </div>
    </div>
  )
}
