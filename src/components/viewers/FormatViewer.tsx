'use client'

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type ValueFormat,
  FORMAT_LABELS,
  ALL_FORMATS,
  autoDetectFormat,
} from '@/lib/format-detect'

import { ViewerText } from './ViewerText'
import { ViewerJson } from './ViewerJson'
import { ViewerHex } from './ViewerHex'
import { ViewerBinary } from './ViewerBinary'
import { ViewerGzip } from './ViewerGzip'
import { ViewerDeflate } from './ViewerDeflate'
import { ViewerDeflateRaw } from './ViewerDeflateRaw'
import { ViewerBrotli } from './ViewerBrotli'
import { ViewerMsgpack } from './ViewerMsgpack'
import { ViewerPHPSerialize } from './ViewerPHPSerialize'
import { ViewerJavaSerialize } from './ViewerJavaSerialize'
import { ViewerPickle } from './ViewerPickle'
import { ViewerProtobuf } from './ViewerProtobuf'
import { ViewerCustom } from './ViewerCustom'
import { ViewerOverSize } from './ViewerOverSize'

const OVER_SIZE_THRESHOLD = 1024 * 1024 // 1 MB

interface FormatViewerProps {
  value: Uint8Array
  readOnly?: boolean
  onChange?: (newValue: Uint8Array) => void
}

function ActiveViewer({
  format,
  value,
  readOnly,
  onChange,
}: {
  format: ValueFormat
  value: Uint8Array
  readOnly: boolean
  onChange?: (newValue: Uint8Array) => void
}) {
  switch (format) {
    case 'text':
      return <ViewerText value={value} readOnly={readOnly} onChange={onChange} />
    case 'json':
      return <ViewerJson value={value} readOnly={readOnly} onChange={onChange} />
    case 'hex':
      return <ViewerHex value={value} />
    case 'binary':
      return <ViewerBinary value={value} />
    case 'gzip':
      return <ViewerGzip value={value} />
    case 'deflate':
      return <ViewerDeflate value={value} />
    case 'deflate-raw':
      return <ViewerDeflateRaw value={value} />
    case 'brotli':
      return <ViewerBrotli value={value} />
    case 'msgpack':
      return <ViewerMsgpack value={value} />
    case 'php-serialize':
      return <ViewerPHPSerialize value={value} />
    case 'java-serialize':
      return <ViewerJavaSerialize value={value} />
    case 'pickle':
      return <ViewerPickle value={value} />
    case 'protobuf':
      return <ViewerProtobuf value={value} />
    case 'custom':
      return <ViewerCustom value={value} />
    default:
      return <ViewerText value={value} readOnly={readOnly} onChange={onChange} />
  }
}

export function FormatViewer({ value, readOnly = true, onChange }: FormatViewerProps) {
  const [format, setFormat] = useState<ValueFormat>(() => autoDetectFormat(value))

  // Re-detect when a different key's value is loaded
  useEffect(() => {
    setFormat(autoDetectFormat(value))
  }, [value])

  if (value.length > OVER_SIZE_THRESHOLD) {
    return <ViewerOverSize size={value.length} />
  }

  return (
    <div className="h-full w-full flex flex-col gap-2">
      {/* Format selector toolbar */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Format:</span>
        <Select value={format} onValueChange={(v) => setFormat(v as ValueFormat)}>
          <SelectTrigger className="h-7 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_FORMATS.map((fmt) => (
              <SelectItem key={fmt} value={fmt} className="text-xs">
                {FORMAT_LABELS[fmt]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {value.length.toLocaleString()} bytes
        </span>
      </div>

      {/* Viewer area */}
      <div className="flex-1 min-h-0">
        <ActiveViewer
          format={format}
          value={value}
          readOnly={readOnly}
          onChange={onChange}
        />
      </div>
    </div>
  )
}
