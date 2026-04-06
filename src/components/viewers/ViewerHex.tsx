'use client'

const HEX_DISPLAY_LIMIT = 4096
const BYTES_PER_ROW = 16

function toHexDump(buf: Uint8Array): string {
  const lines: string[] = []
  const limit = Math.min(buf.length, HEX_DISPLAY_LIMIT)

  for (let offset = 0; offset < limit; offset += BYTES_PER_ROW) {
    const rowBytes = buf.slice(offset, Math.min(offset + BYTES_PER_ROW, limit))

    // Offset column
    const offsetStr = offset.toString(16).padStart(8, '0')

    // Hex columns (two groups of 8, separated by extra space)
    const hexParts: string[] = []
    for (let i = 0; i < BYTES_PER_ROW; i++) {
      if (i < rowBytes.length) {
        hexParts.push(rowBytes[i].toString(16).padStart(2, '0'))
      } else {
        hexParts.push('  ')
      }
      if (i === 7) hexParts.push(' ') // mid-row gap
    }
    const hexStr = hexParts.join(' ')

    // ASCII column
    const asciiStr = Array.from(rowBytes)
      .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
      .join('')

    lines.push(`${offsetStr}  ${hexStr}  |${asciiStr}|`)
  }

  return lines.join('\n')
}

export function ViewerHex({ value }: { value: Uint8Array }) {
  const truncated = value.length > HEX_DISPLAY_LIMIT
  const hexContent = toHexDump(value)

  return (
    <div className="h-full w-full flex flex-col gap-1">
      {truncated && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/40 border border-border rounded shrink-0">
          Showing first {HEX_DISPLAY_LIMIT.toLocaleString()} of {value.length.toLocaleString()} bytes.
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        <pre className="font-mono text-xs p-3 whitespace-pre leading-relaxed text-foreground">
          {hexContent}
        </pre>
      </div>
    </div>
  )
}
