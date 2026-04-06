import fs from 'fs'
import path from 'path'
import writeFileAtomic from 'write-file-atomic'
import type { ConnectionConfig } from './redis-pool'

export interface StoredConnection extends ConnectionConfig {
  key: string
  order: number
  color?: string
  emoji?: string
}

export type ConnectionsMap = Record<string, StoredConnection>

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const DATA_PATH = path.join(dataDir, 'connections.json')

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

export function getConnections(): ConnectionsMap {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8')
    return JSON.parse(raw) as ConnectionsMap
  } catch (e: any) {
    if (e.code === 'ENOENT') return {}
    throw e
  }
}

export function setConnections(obj: ConnectionsMap): void {
  writeFileAtomic.sync(DATA_PATH, JSON.stringify(obj, null, 2))
}

export function getConnectionsList(): StoredConnection[] {
  const connections = getConnections()
  return Object.values(connections).sort((a, b) => {
    if (!isNaN(a.order) && !isNaN(b.order)) {
      return a.order - b.order
    }
    if (a.key && b.key) return a.key < b.key ? -1 : 1
    return a.key ? 1 : b.key ? -1 : 0
  })
}

function randomString(len = 5): string {
  return Math.random().toString(36).slice(2, 2 + len)
}

export function buildConnectionKey(): string {
  return `${Date.now()}_${randomString(5)}`
}
