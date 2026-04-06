export interface ConnectionConfig {
  host: string
  port: number
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

export interface StoredConnection extends ConnectionConfig {
  key: string
  order: number
  color?: string
  emoji?: string
}

/** The "displayable" connection name derived from name or host:port */
export function getConnectionDisplayName(conn: StoredConnection): string {
  return conn.name || conn.connectionName || `${conn.host}:${conn.port}`
}

/** Get initials for collapsed sidebar (max 2 uppercase chars) */
export function getConnectionInitials(conn: StoredConnection): string {
  const name = getConnectionDisplayName(conn)
  const words = name.trim().split(/[\s_-]+/).filter(Boolean)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}
