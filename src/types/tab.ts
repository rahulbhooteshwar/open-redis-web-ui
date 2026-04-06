export type TabType = 'key' | 'cli' | 'status' | 'delbatch' | 'memory' | 'slowlog'

interface BaseTab {
  id: string
  connectionKey: string
  label: string
  title: string
}

export interface KeyTab extends BaseTab {
  type: 'key'
  redisKey: string       // base64-encoded key bytes
  keyType: string
}

export interface CliTab extends BaseTab {
  type: 'cli'
}

export interface StatusTab extends BaseTab {
  type: 'status'
}

export interface DelBatchTab extends BaseTab {
  type: 'delbatch'
  pattern?: string
}

export interface MemoryTab extends BaseTab {
  type: 'memory'
  pattern?: string
}

export interface SlowLogTab extends BaseTab {
  type: 'slowlog'
}

export type Tab = KeyTab | CliTab | StatusTab | DelBatchTab | MemoryTab | SlowLogTab
