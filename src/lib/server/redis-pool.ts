import { Redis, Cluster } from 'ioredis'
import type { RedisOptions, ClusterOptions } from 'ioredis'
import fs from 'fs'
import { sshService } from './ssh-service'

export interface ConnectionConfig {
  host?: string
  port?: number
  auth?: string
  password?: string
  username?: string
  db?: number
  connectionName?: string
  name?: string
  cluster?: boolean
  connectionReadOnly?: boolean
  natMap?: Record<string, { host: string; port: number }>
  sshOptions?: SSHOptions
  sslOptions?: SSLOptions
  sentinelOptions?: SentinelOptions
}

export interface SSHOptions {
  host: string
  port: number
  username: string
  password?: string
  privatekey?: string
  passphrase?: string
  timeout?: number
}

export interface SSLOptions {
  ca?: string
  key?: string
  cert?: string
  servername?: string
}

export interface SentinelOptions {
  masterName: string
  nodePassword?: string
}

// Detect Docker container
const IS_DOCKER = (() => {
  if (process.env.DOCKER_CONTAINER === '1') return true
  try { fs.accessSync('/.dockerenv'); return true } catch { return false }
})()

function resolveHost(host: string): string {
  if (IS_DOCKER && (host === 'localhost' || host === '127.0.0.1' || host === '::1')) {
    return 'host.docker.internal'
  }
  return host
}

// Fix ioredis hgetall: return [[key, val], ...] instead of flat array
;(Redis.Command as any).setReplyTransformer('hgetall', (result: string[]) => {
  const arr: [string, string][] = []
  for (let i = 0; i < result.length; i += 2) {
    arr.push([result[i], result[i + 1]])
  }
  return arr
})

// Attach pool to globalThis so it survives Next.js HMR re-evaluation in dev mode.
// Without this, any file change that triggers hot reload clears the Map and
// all active ioredis connections are lost, causing 500 "No active connection" errors.
const g = globalThis as typeof globalThis & { __redisPool?: Map<string, Redis | Cluster> }
if (!g.__redisPool) g.__redisPool = new Map()
const pool = g.__redisPool

function retryStrategy(times: number): number | null {
  const maxRetries = 3
  if (times >= maxRetries) {
    console.error('Too many reconnect attempts. Check server status.')
    return null
  }
  return Math.min(times * 200, 1000)
}

function getTLSOptions(options: SSLOptions) {
  return {
    ca: options.ca || undefined,
    key: options.key || undefined,
    cert: options.cert || undefined,
    servername: options.servername || undefined,
    checkServerIdentity: () => undefined,
    rejectUnauthorized: false,
  }
}

function buildRedisOptions(host: string, port: number, auth: string | undefined, config: ConnectionConfig): RedisOptions {
  return {
    host,
    port,
    connectTimeout: 30000,
    retryStrategy,
    enableReadyCheck: false,
    connectionName: config.connectionName || undefined,
    password: auth,
    db: config.db || undefined,
    username: config.username || undefined,
    tls: config.sslOptions ? getTLSOptions(config.sslOptions) : undefined,
    readOnly: config.connectionReadOnly ? true : undefined,
    stringNumbers: true,
  } as RedisOptions
}

function getSentinelOptions(host: string, port: number, auth: string | undefined, config: ConnectionConfig) {
  return {
    sentinels: [{ host, port }],
    sentinelPassword: auth,
    password: config.sentinelOptions!.nodePassword,
    name: config.sentinelOptions!.masterName,
    connectTimeout: 30000,
    retryStrategy,
    enableReadyCheck: false,
    connectionName: config.connectionName || undefined,
    db: config.db || undefined,
    username: config.username || undefined,
    tls: config.sslOptions ? getTLSOptions(config.sslOptions) : undefined,
  }
}

export function createConnection(
  host: string,
  port: number,
  auth: string | undefined,
  config: ConnectionConfig,
  asPromise = true,
  forceStandalone = false,
  removeDb = false,
): Promise<Redis> | Redis | Cluster {
  const options = buildRedisOptions(host, port, auth, config)
  if (removeDb) delete options.db

  let client: Redis | Cluster

  if (forceStandalone) {
    client = new Redis(options)
  } else if (config.sentinelOptions) {
    const sentinelOpts = getSentinelOptions(host, port, auth, config)
    client = new Redis(sentinelOpts as any)
  } else if (config.cluster) {
    const clusterOptions: ClusterOptions = {
      enableReadyCheck: false,
      slotsRefreshTimeout: 30000,
      redisOptions: options,
      natMap: config.natMap || {},
    } as ClusterOptions
    client = new Cluster([{ port, host }], clusterOptions)
  } else {
    client = new Redis(options)
  }

  if (asPromise) {
    return new Promise<Redis>((resolve, reject) => {
      client.once('ready', () => resolve(client as Redis))
      client.once('error', (err: Error) => {
        ;(client as Redis).disconnect()
        reject(err)
      })
    })
  }
  return client
}

export function buildKey(config: ConnectionConfig): string {
  const host = config.host || '127.0.0.1'
  const port = config.port || 6379
  const db = config.db || 0
  const name = config.connectionName || config.name || ''
  return `${host}:${port}:${db}:${name}`
}

export async function connect(connectionConfig: ConnectionConfig): Promise<string> {
  const { host: rawHost = '127.0.0.1', port = 6379, auth, password, sshOptions, ...config } = connectionConfig
  const resolvedAuth = auth || password
  const host = resolveHost(rawHost)
  const key = buildKey(connectionConfig)

  if (pool.has(key)) {
    await disconnect(key)
  }

  let client: Redis | Cluster

  if (sshOptions?.host) {
    client = await sshService.createSSHConnection(
      sshOptions, rawHost, port, resolvedAuth, config as ConnectionConfig, { createConnection },
    ) as Redis
  } else {
    client = await createConnection(host, port, resolvedAuth, config as ConnectionConfig) as Redis
  }

  pool.set(key, client)
  return key
}

export async function disconnect(key: string): Promise<void> {
  const client = pool.get(key)
  if (!client) return
  pool.delete(key)
  try { await (client as Redis).quit() } catch { /* ignore */ }
}

export async function disconnectAll(): Promise<void> {
  const keys = [...pool.keys()]
  await Promise.allSettled(keys.map(k => disconnect(k)))
}

export function getClient(key: string): Redis | Cluster {
  const client = pool.get(key)
  if (!client) throw new Error(`No active connection for key: ${key}`)
  return client
}

export function hasConnection(key: string): boolean {
  return pool.has(key)
}

export const redisPool = {
  connect,
  disconnect,
  disconnectAll,
  getClient,
  hasConnection,
  buildKey,
  createConnection,
}
