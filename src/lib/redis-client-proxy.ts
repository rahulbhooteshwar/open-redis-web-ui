'use client'

/**
 * redis-client-proxy.ts
 *
 * Browser-side ioredis-compatible shim. Delegates all Redis operations to the
 * Express REST/WebSocket server. Uses Uint8Array instead of Node.js Buffer.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function b64ToUint8Array(b64: string): Uint8Array {
  const binStr = atob(b64)
  const bytes = new Uint8Array(binStr.length)
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i)
  }
  return bytes
}

export function uint8ArrayToB64(buf: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buf.length; i++) {
    binary += String.fromCharCode(buf[i])
  }
  return btoa(binary)
}

// ---------------------------------------------------------------------------
// API fetch helpers
// ---------------------------------------------------------------------------

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (json && typeof json === 'object' && (json as Record<string, unknown>).error) {
    throw new Error((json as Record<string, unknown>).message as string || 'Server error')
  }
  return json
}

function apiFetchPost(path: string, body: unknown): Promise<unknown> {
  return apiFetch(path, { method: 'POST', body: JSON.stringify(body) })
}

function apiFetchGet(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const q = new URLSearchParams(params).toString()
  return apiFetch(q ? `${path}?${q}` : path)
}

// ---------------------------------------------------------------------------
// EventEmitter shim
// ---------------------------------------------------------------------------

type EventListener = (...args: unknown[]) => void

function makeEmitter() {
  const listeners: Record<string, EventListener[]> = {}
  return {
    on(event: string, fn: EventListener) {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(fn)
      return this
    },
    emit(event: string, ...args: unknown[]) {
      ;(listeners[event] || []).forEach((fn) => fn(...args))
    },
    off(event: string, fn: EventListener) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((f) => f !== fn)
      }
    },
  }
}

// ---------------------------------------------------------------------------
// ScanStream shim
// ---------------------------------------------------------------------------

export interface ScanStream {
  on: (event: 'data' | 'end' | 'error', fn: (...args: unknown[]) => void) => void
  pause: () => void
  resume: () => void
  emit: (event: string, ...args: unknown[]) => void
}

interface ScanParams {
  match?: string
  count?: number
  scanType?: string
  scanKey?: Uint8Array | string
}

function makeScanStream(connectionKey: string, scanParams: ScanParams): ScanStream {
  const { match = '*', count = 200, scanType, scanKey } = scanParams

  const emitter = makeEmitter()
  let cursor = '0'
  let paused = false
  let running = false
  let done = false

  async function scanPage() {
    if (done || paused) return
    running = true

    try {
      const params: Record<string, string> = {
        cursor,
        match,
        count: String(count),
      }
      if (scanType) params.scanType = scanType
      if (scanKey !== undefined) {
        if (scanKey instanceof Uint8Array) {
          params.scanKey = uint8ArrayToB64(scanKey)
          params.scanKeyEncoding = 'base64'
        } else {
          params.scanKey = scanKey as string
        }
      }

      const data = (await apiFetchGet(`/api/redis/${connectionKey}/scan`, params)) as {
        cursor: string
        items?: string[]
      }
      cursor = data.cursor

      if (data.items && data.items.length > 0) {
        const buffers = data.items.map((b64) => b64ToUint8Array(b64))
        emitter.emit('data', buffers)
      }

      if (cursor === '0') {
        done = true
        running = false
        emitter.emit('end')
        return
      }

      running = false
      if (!paused) scanPage()
    } catch (e) {
      running = false
      emitter.emit('error', e)
    }
  }

  setTimeout(() => scanPage(), 0)

  return {
    on: emitter.on.bind(emitter),
    emit: emitter.emit.bind(emitter),
    pause() {
      paused = true
    },
    resume() {
      if (paused) {
        paused = false
        if (!running && !done) scanPage()
      }
    },
  }
}

// ---------------------------------------------------------------------------
// RedisClientProxy interface
// ---------------------------------------------------------------------------

export interface RedisClientProxy {
  connectionKey: string
  connectionName: string
  db: number
  status: 'ready' | 'connecting' | 'error'

  on: (event: string, fn: EventListener) => void
  off: (event: string, fn: EventListener) => void

  call: (command: string, ...rest: unknown[]) => Promise<unknown>
  callBuffer: (command: string, ...rest: unknown[]) => Promise<unknown>

  scan: (cursor: string, ...args: unknown[]) => Promise<unknown>
  scanBufferStream: (opts?: { match?: string; count?: number }) => ScanStream
  hscanBufferStream: (key: unknown, opts?: { match?: string; count?: number }) => ScanStream
  sscanBufferStream: (key: unknown, opts?: { match?: string; count?: number }) => ScanStream
  zscanBufferStream: (key: unknown, opts?: { match?: string; count?: number }) => ScanStream

  select: (db: number) => Promise<unknown>
  ping: () => Promise<string>
  quit: () => Promise<void>
  duplicate: () => RedisClientProxy

  // String
  get: (key: unknown) => Promise<string | null>
  getBuffer: (key: unknown) => Promise<Uint8Array | null>
  set: (key: unknown, val: unknown, ...rest: unknown[]) => Promise<unknown>

  // Hash
  hget: (key: unknown, field: unknown) => Promise<string | null>
  hgetall: (key: unknown) => Promise<Record<string, string> | null>
  hset: (key: unknown, ...args: unknown[]) => Promise<unknown>
  hdel: (key: unknown, ...fields: unknown[]) => Promise<number>
  hlen: (key: unknown) => Promise<number>

  // List
  lrange: (key: unknown, start: number, end: number) => Promise<string[]>
  lrangeBuffer: (args: unknown[]) => Promise<Uint8Array[]>
  llen: (key: unknown) => Promise<number>
  lset: (key: unknown, index: number, val: unknown) => Promise<unknown>
  linsert: (key: unknown, direction: string, pivot: unknown, val: unknown) => Promise<number>
  lrem: (key: unknown, count: number, val: unknown) => Promise<number>
  rpush: (key: unknown, ...vals: unknown[]) => Promise<number>
  lpush: (key: unknown, ...vals: unknown[]) => Promise<number>

  // Set
  smembers: (key: unknown) => Promise<string[]>
  sadd: (key: unknown, ...members: unknown[]) => Promise<number>
  srem: (key: unknown, ...members: unknown[]) => Promise<number>
  scard: (key: unknown) => Promise<number>

  // ZSet
  zscore: (key: unknown, member: unknown) => Promise<string | null>
  zrange: (key: unknown, start: unknown, stop: unknown, ...rest: unknown[]) => Promise<string[]>
  zrangeBuffer: (args: unknown[]) => Promise<Uint8Array[]>
  zrevrangeBuffer: (args: unknown[]) => Promise<Uint8Array[]>
  zadd: (key: unknown, ...args: unknown[]) => Promise<unknown>
  zrem: (key: unknown, ...members: unknown[]) => Promise<number>
  zcard: (key: unknown) => Promise<number>
  zcount: (key: unknown, min: unknown, max: unknown) => Promise<number>

  // Stream
  xrange: (key: unknown, start: unknown, end: unknown, ...rest: unknown[]) => Promise<unknown>
  xrevrangeBuffer: (args: unknown[]) => Promise<unknown>
  xadd: (key: unknown, id: unknown, ...args: unknown[]) => Promise<string>
  xlen: (key: unknown) => Promise<number>
  xdel: (key: unknown, ...ids: unknown[]) => Promise<number>

  // Key ops
  del: (...keys: unknown[]) => Promise<number>
  exists: (...keys: unknown[]) => Promise<number>
  type: (key: unknown) => Promise<string>
  rename: (key: unknown, newKey: unknown) => Promise<unknown>
  expire: (key: unknown, secs: number) => Promise<number>
  ttl: (key: unknown) => Promise<number>
  pttl: (key: unknown) => Promise<number>
  persist: (key: unknown) => Promise<number>
  memory: (op: string, key: unknown) => Promise<number>
  flushdb: () => Promise<unknown>

  // Server
  info: (section?: string) => Promise<string>
  config: (op: string, ...args: unknown[]) => Promise<unknown>

  // Cluster shim
  nodes: (role?: string) => RedisClientProxy[]
}

// ---------------------------------------------------------------------------
// createClientProxy
// ---------------------------------------------------------------------------

export function createClientProxy(
  connectionKey: string,
  config: {
    connectionName?: string
    name?: string
    db?: number
    natMap?: Record<string, unknown>
  },
): RedisClientProxy {
  const emitter = makeEmitter()
  let currentDb = config.db ?? 0

  // Emit 'ready' asynchronously — server already connected successfully
  setTimeout(() => emitter.emit('ready'), 0)

  function serializeArg(a: unknown): unknown {
    if (a instanceof Uint8Array) return { __buf: uint8ArrayToB64(a) }
    return a
  }

  function callServer(command: string, args: unknown[] = [], buffer = false): Promise<unknown> {
    return apiFetchPost(`/api/redis/${connectionKey}/call`, {
      command,
      args: args.map(serializeArg),
      buffer,
    })
  }

  function decodeResult(json: unknown): unknown {
    const j = json as { encoding?: string; result: unknown }
    if (j.encoding === 'base64') {
      if (Array.isArray(j.result)) {
        return j.result.map((r) => (typeof r === 'string' ? b64ToUint8Array(r) : r))
      }
      return typeof j.result === 'string' ? b64ToUint8Array(j.result) : j.result
    }
    return j.result
  }

  function cmd(command: string, args: unknown[] = []): Promise<unknown> {
    return callServer(command, args).then((json) => (json as { result: unknown }).result)
  }

  function cmdBuffer(command: string, args: unknown[] = []): Promise<unknown> {
    return callServer(command, args, true).then(decodeResult)
  }

  const proxy: RedisClientProxy = {
    status: 'ready',
    connectionKey,
    connectionName: config.connectionName ?? config.name ?? '',
    get db() {
      return currentDb
    },

    on: (event, fn) => emitter.on(event, fn as EventListener),
    off: (event, fn) => emitter.off(event, fn as EventListener),

    ping(): Promise<string> {
      return cmd('PING') as Promise<string>
    },

    async quit(): Promise<void> {
      await apiFetchPost('/api/redis/disconnect', { key: connectionKey })
    },

    async select(db: number): Promise<unknown> {
      const res = await apiFetchPost(`/api/redis/${connectionKey}/select`, { db })
      currentDb = db
      return res
    },

    async info(_section?: string): Promise<string> {
      const data = (await apiFetchGet(`/api/redis/${connectionKey}/info`)) as { info: string }
      return data.info
    },

    async config(op: string, ...args: unknown[]): Promise<unknown> {
      if (op === 'get' || op === 'GET') {
        const pattern = (args[0] as string) || '*'
        const data = (await apiFetchGet(`/api/redis/${connectionKey}/config`, { pattern })) as {
          disabled?: boolean
          config: unknown
        }
        if (data.disabled || data.config === null) {
          throw new Error('CONFIG command disabled on this server')
        }
        return data.config
      }
      return cmd('CONFIG', [op, ...args])
    },

    call(command: string, ...rest: unknown[]): Promise<unknown> {
      const args = rest.length === 1 && Array.isArray(rest[0]) ? (rest[0] as unknown[]) : rest
      return cmd(command, args)
    },

    callBuffer(command: string, ...rest: unknown[]): Promise<unknown> {
      const args = rest.length === 1 && Array.isArray(rest[0]) ? (rest[0] as unknown[]) : rest
      return cmdBuffer(command, args)
    },

    // String
    get: (key) => cmd('GET', [key]) as Promise<string | null>,
    getBuffer: (key) => cmdBuffer('GET', [key]) as Promise<Uint8Array | null>,
    set: (key, val, ...rest) => cmd('SET', [key, val, ...rest]),

    // Hash
    hset: (key, ...args) => cmd('HSET', [key, ...args]),
    hget: (key, field) => cmd('HGET', [key, field]) as Promise<string | null>,
    hgetall: (key) => cmd('HGETALL', [key]) as Promise<Record<string, string> | null>,
    hdel: (key, ...fields) => cmd('HDEL', [key, ...fields]) as Promise<number>,
    hlen: (key) => cmd('HLEN', [key]) as Promise<number>,
    hscanBufferStream: (key, opts = {}) =>
      makeScanStream(connectionKey, {
        match: opts.match ?? '*',
        count: opts.count ?? 200,
        scanType: 'hscanBuffer',
        scanKey: key instanceof Uint8Array ? key : undefined,
      }),

    // List
    lrange: (key, start, end) => cmd('LRANGE', [key, start, end]) as Promise<string[]>,
    lrangeBuffer: (args) => cmdBuffer('LRANGE', args) as Promise<Uint8Array[]>,
    llen: (key) => cmd('LLEN', [key]) as Promise<number>,
    lset: (key, index, val) => cmd('LSET', [key, index, val]),
    linsert: (key, direction, pivot, val) =>
      cmd('LINSERT', [key, direction, pivot, val]) as Promise<number>,
    lrem: (key, count, val) => cmd('LREM', [key, count, val]) as Promise<number>,
    rpush: (key, ...vals) => cmd('RPUSH', [key, ...vals]) as Promise<number>,
    lpush: (key, ...vals) => cmd('LPUSH', [key, ...vals]) as Promise<number>,

    // Set
    sadd: (key, ...members) => cmd('SADD', [key, ...members]) as Promise<number>,
    srem: (key, ...members) => cmd('SREM', [key, ...members]) as Promise<number>,
    smembers: (key) => cmd('SMEMBERS', [key]) as Promise<string[]>,
    scard: (key) => cmd('SCARD', [key]) as Promise<number>,
    sscanBufferStream: (key, opts = {}) =>
      makeScanStream(connectionKey, {
        match: opts.match ?? '*',
        count: opts.count ?? 200,
        scanType: 'sscanBuffer',
        scanKey: key instanceof Uint8Array ? key : undefined,
      }),

    // ZSet
    zadd: (key, ...args) => cmd('ZADD', [key, ...args]),
    zrem: (key, ...members) => cmd('ZREM', [key, ...members]) as Promise<number>,
    zrange: (key, start, stop, ...rest) =>
      cmd('ZRANGE', [key, start, stop, ...rest]) as Promise<string[]>,
    zrangeBuffer: (args) => cmdBuffer('ZRANGE', args) as Promise<Uint8Array[]>,
    zrevrangeBuffer: (args) => cmdBuffer('ZREVRANGE', args) as Promise<Uint8Array[]>,
    zcard: (key) => cmd('ZCARD', [key]) as Promise<number>,
    zscore: (key, member) => cmd('ZSCORE', [key, member]) as Promise<string | null>,
    zcount: (key, min, max) => cmd('ZCOUNT', [key, min, max]) as Promise<number>,
    zscanBufferStream: (key, opts = {}) =>
      makeScanStream(connectionKey, {
        match: opts.match ?? '*',
        count: opts.count ?? 200,
        scanType: 'zscanBuffer',
        scanKey: key instanceof Uint8Array ? key : undefined,
      }),

    // Stream
    xadd: (key, id, ...args) => cmd('XADD', [key, id, ...args]) as Promise<string>,
    xlen: (key) => cmd('XLEN', [key]) as Promise<number>,
    xrange: (key, start, end, ...rest) => cmd('XRANGE', [key, start, end, ...rest]),
    xrevrangeBuffer: (args) => cmdBuffer('XREVRANGE', args),
    xdel: (key, ...ids) => cmd('XDEL', [key, ...ids]) as Promise<number>,

    // Key ops
    del: (...keys) => cmd('DEL', (keys as unknown[][]).flat()) as Promise<number>,
    exists: (...keys) => cmd('EXISTS', (keys as unknown[][]).flat()) as Promise<number>,
    type: (key) => cmd('TYPE', [key]) as Promise<string>,
    rename: (key, newKey) => cmd('RENAME', [key, newKey]),
    expire: (key, secs) => cmd('EXPIRE', [key, secs]) as Promise<number>,
    persist: (key) => cmd('PERSIST', [key]) as Promise<number>,
    pttl: (key) => cmd('PTTL', [key]) as Promise<number>,
    ttl: (key) => cmd('TTL', [key]) as Promise<number>,
    memory: (op, key) => cmd('MEMORY', [op, key]) as Promise<number>,
    flushdb: () => cmd('FLUSHDB'),

    // Scan
    scan: (cursor, ...args) => cmd('SCAN', [cursor, ...args]),
    scanBufferStream: (opts = {}) =>
      makeScanStream(connectionKey, {
        match: opts.match ?? '*',
        count: opts.count ?? 200,
      }),

    // Cluster shim — non-cluster: nodes() returns [this]
    nodes: (_role?: string) => [proxy],

    duplicate: () => createClientProxy(connectionKey, config),
  }

  return proxy
}

// ---------------------------------------------------------------------------
// connectViaServer
// ---------------------------------------------------------------------------

async function resolveBlobUrl(value: string): Promise<string> {
  if (typeof value === 'string' && value.startsWith('blob:')) {
    const res = await fetch(value)
    return res.text()
  }
  return value
}

export async function connectViaServer(config: Record<string, unknown>): Promise<RedisClientProxy> {
  // Resolve any blob: URLs in sshOptions (browser-local, server cannot fetch them)
  if (config.sshOptions && typeof config.sshOptions === 'object') {
    const ssh = config.sshOptions as Record<string, string>
    if (ssh.privatekey) ssh.privatekey = await resolveBlobUrl(ssh.privatekey)
  }
  if (config.sslOptions && typeof config.sslOptions === 'object') {
    const ssl = config.sslOptions as Record<string, string>
    if (ssl.key) ssl.key = await resolveBlobUrl(ssl.key)
    if (ssl.cert) ssl.cert = await resolveBlobUrl(ssl.cert)
    if (ssl.ca) ssl.ca = await resolveBlobUrl(ssl.ca)
  }

  const data = (await apiFetchPost('/api/redis/connect', config)) as { key: string }
  return createClientProxy(data.key, config as Parameters<typeof createClientProxy>[1])
}
