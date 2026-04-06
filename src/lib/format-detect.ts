'use client'

/**
 * Format auto-detection utilities for Redis values.
 * All functions accept a Uint8Array and return boolean.
 */

export type ValueFormat =
  | 'text'
  | 'json'
  | 'hex'
  | 'binary'
  | 'msgpack'
  | 'php-serialize'
  | 'java-serialize'
  | 'pickle'
  | 'gzip'
  | 'brotli'
  | 'deflate'
  | 'deflate-raw'
  | 'protobuf'
  | 'custom'

export function isJson(buf: Uint8Array): boolean {
  if (!buf || buf.length === 0) return false
  try {
    const str = new TextDecoder('utf-8', { fatal: true }).decode(buf).trim()
    if ((str[0] === '{' && str[str.length - 1] === '}') ||
        (str[0] === '[' && str[str.length - 1] === ']')) {
      JSON.parse(str)
      return true
    }
    return false
  } catch {
    return false
  }
}

export function isGzip(buf: Uint8Array): boolean {
  return buf && buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b
}

export function isDeflate(buf: Uint8Array): boolean {
  if (!buf || buf.length < 2) return false
  // zlib header: first byte & 0x0f === 8, second byte: (b0*256 + b1) % 31 === 0
  const b0 = buf[0]
  const b1 = buf[1]
  return (b0 & 0x0f) === 8 && ((b0 * 256 + b1) % 31) === 0
}

export function isDeflateRaw(buf: Uint8Array): boolean {
  if (!buf || buf.length < 2) return false
  // Deflate raw: starts with valid deflate block header (bfinal/btype bits)
  // First byte bits 0-2: BFINAL (0 or 1) + BTYPE (00, 01, 10)
  const b0 = buf[0]
  const btype = (b0 >> 1) & 0x03
  return btype <= 2 && !isDeflate(buf)
}

export function isBrotli(buf: Uint8Array): boolean {
  // Brotli has no magic number — heuristic: first byte low nibble usually 0-15
  // We can't reliably detect brotli without trying to decompress
  return false
}

export function isMsgpack(buf: Uint8Array): boolean {
  if (!buf || buf.length === 0) return false
  const b = buf[0]
  // Msgpack type markers:
  // fixint: 0x00-0x7f
  // fixmap: 0x80-0x8f
  // fixarray: 0x90-0x9f
  // fixstr: 0xa0-0xbf
  // nil: 0xc0
  // false/true: 0xc2-0xc3
  // float/double: 0xca-0xcb
  // uint8-64: 0xcc-0xcf
  // int8-64: 0xd0-0xd3
  // fixext: 0xd4-0xd8
  // str8-32: 0xd9-0xdb
  // array16-32: 0xdc-0xdd
  // map16-32: 0xde-0xdf
  // negfixint: 0xe0-0xff
  return (
    (b >= 0x80 && b <= 0x8f) || // fixmap
    (b >= 0x90 && b <= 0x9f) || // fixarray
    (b >= 0xa0 && b <= 0xbf) || // fixstr
    b === 0xc0 || b === 0xc2 || b === 0xc3 || // nil/bool
    (b >= 0xca && b <= 0xcf) || // float/uint
    (b >= 0xdc && b <= 0xdf)   // array/map 16/32
  )
}

export function isPHPSerialize(buf: Uint8Array): boolean {
  if (!buf || buf.length < 2) return false
  try {
    const str = new TextDecoder('latin1').decode(buf)
    // PHP serialized format starts with type indicator: s:, i:, d:, b:, a:, o:, N;
    return /^(s:|i:|d:|b:|a:|o:|O:|N;|C:)/.test(str)
  } catch {
    return false
  }
}

export function isJavaSerialize(buf: Uint8Array): boolean {
  // Java serialized objects start with magic bytes 0xac 0xed
  return buf && buf.length >= 2 && buf[0] === 0xac && buf[1] === 0xed
}

export function isPickle(buf: Uint8Array): boolean {
  if (!buf || buf.length === 0) return false
  // Python pickle protocols:
  // Protocol 0: starts with bytes in printable range
  // Protocol 1: starts with 0x28 '('
  // Protocol 2: starts with 0x80 0x02
  // Protocol 3: starts with 0x80 0x03
  // Protocol 4: starts with 0x80 0x04
  // Protocol 5: starts with 0x80 0x05
  if (buf[0] === 0x80 && buf[1] >= 0x02 && buf[1] <= 0x05) return true
  return false
}

export function isProtobuf(buf: Uint8Array): boolean {
  if (!buf || buf.length < 2) return false
  // Protobuf is hard to detect without a schema.
  // Heuristic: first byte encodes field number (upper 5 bits) + wire type (lower 3 bits)
  // Wire types: 0=varint, 1=64bit, 2=length-delimited, 5=32bit
  const wireType = buf[0] & 0x07
  return wireType === 0 || wireType === 1 || wireType === 2 || wireType === 5
}

/**
 * Auto-detect the best format for displaying a Redis value.
 */
export function autoDetectFormat(buf: Uint8Array): ValueFormat {
  if (!buf || buf.length === 0) return 'text'
  if (isJson(buf)) return 'json'
  if (isGzip(buf)) return 'gzip'
  if (isDeflate(buf)) return 'deflate'
  if (isMsgpack(buf)) return 'msgpack'
  if (isJavaSerialize(buf)) return 'java-serialize'
  if (isPHPSerialize(buf)) return 'php-serialize'
  if (isPickle(buf)) return 'pickle'
  return 'text'
}

export const FORMAT_LABELS: Record<ValueFormat, string> = {
  text: 'Text',
  json: 'JSON',
  hex: 'Hex',
  binary: 'Binary',
  msgpack: 'Msgpack',
  'php-serialize': 'PHP Serialize',
  'java-serialize': 'Java Serialize',
  pickle: 'Python Pickle',
  gzip: 'Gzip',
  brotli: 'Brotli',
  deflate: 'Deflate',
  'deflate-raw': 'Deflate Raw',
  protobuf: 'Protobuf',
  custom: 'Custom',
}

export const ALL_FORMATS: ValueFormat[] = [
  'text', 'json', 'hex', 'binary', 'msgpack',
  'php-serialize', 'java-serialize', 'pickle',
  'gzip', 'brotli', 'deflate', 'deflate-raw',
  'protobuf', 'custom',
]
