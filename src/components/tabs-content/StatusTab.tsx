'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Server, Cpu, Database, Network, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { StatusTab as StatusTabType } from '@/types/tab'

interface Props { tab: StatusTabType }

interface InfoSection {
  title: string
  icon: React.ReactNode
  rows: Array<{ label: string; value: string }>
  extraContent?: React.ReactNode
}

function parseInfo(raw: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue
    result[trimmed.slice(0, colonIdx).trim()] = trimmed.slice(colonIdx + 1).trim()
  }
  return result
}

function parseClientIPs(raw: string): string[] {
  const ips = new Set<string>()
  for (const line of raw.split('\n')) {
    const match = line.match(/addr=([^:\s]+):/)
    if (match) ips.add(match[1])
  }
  return [...ips].sort()
}

function parseConfig(flat: string[]): Array<{ key: string; value: string }> {
  const result: Array<{ key: string; value: string }> = []
  for (let i = 0; i + 1 < flat.length; i += 2) {
    result.push({ key: flat[i], value: flat[i + 1] })
  }
  return result.sort((a, b) => a.key.localeCompare(b.key))
}

export function StatusTab({ tab }: Props) {
  const [info, setInfo] = useState<Record<string, string>>({})
  const [clientIPs, setClientIPs] = useState<string[]>([])
  const [configRows, setConfigRows] = useState<Array<{ key: string; value: string }>>([])
  const [configSearch, setConfigSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchInfo = async () => {
    setLoading(true)
    try {
      const [infoRes, clientsRes, configRes] = await Promise.all([
        fetch(`/api/redis/${tab.connectionKey}/info`),
        fetch(`/api/server/${tab.connectionKey}/clients`),
        fetch(`/api/redis/${tab.connectionKey}/config?pattern=*`),
      ])
      const infoData = await infoRes.json()
      setInfo(parseInfo(infoData.info || ''))
      const clientsData = await clientsRes.json()
      setClientIPs(parseClientIPs(clientsData.list || ''))
      const configData = await configRes.json()
      if (Array.isArray(configData.config)) {
        setConfigRows(parseConfig(configData.config))
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { fetchInfo() }, [tab.connectionKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const sections: InfoSection[] = [
    {
      title: 'Server',
      icon: <Server className="h-4 w-4" />,
      rows: [
        { label: 'Redis Version', value: info.redis_version || '' },
        { label: 'Mode', value: info.redis_mode || 'standalone' },
        { label: 'OS', value: info.os || '' },
        { label: 'Arch', value: info.arch_bits ? `${info.arch_bits}-bit` : '' },
        { label: 'TCP Port', value: info.tcp_port || '' },
        { label: 'Uptime', value: info.uptime_in_days ? `${info.uptime_in_days} days` : '' },
        { label: 'Config File', value: info.config_file || '(default)' },
      ],
    },
    {
      title: 'Clients',
      icon: <Network className="h-4 w-4" />,
      rows: [
        { label: 'Connected Clients', value: info.connected_clients || '' },
        { label: 'Blocked Clients', value: info.blocked_clients || '' },
        { label: 'Max Clients', value: info.maxclients || '' },
      ],
      extraContent: clientIPs.length > 0 ? (
        <div className="mt-2 pt-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground mb-1">Unique client IPs</p>
          <div className="space-y-0.5">
            {clientIPs.map((ip) => (
              <div key={ip} className="text-xs font-mono text-right">{ip}</div>
            ))}
          </div>
        </div>
      ) : null,
    },
    {
      title: 'Memory',
      icon: <Cpu className="h-4 w-4" />,
      rows: [
        { label: 'Used Memory', value: info.used_memory_human || '' },
        { label: 'RSS Memory', value: info.used_memory_rss_human || '' },
        { label: 'Peak Memory', value: info.used_memory_peak_human || '' },
        { label: 'Max Memory', value: info.maxmemory_human || '0 (unlimited)' },
        { label: 'Eviction Policy', value: info.maxmemory_policy || '' },
        { label: 'Fragmentation', value: info.mem_fragmentation_ratio ? `${parseFloat(info.mem_fragmentation_ratio).toFixed(2)}` : '' },
      ],
    },
    {
      title: 'Stats',
      icon: <Database className="h-4 w-4" />,
      rows: [
        { label: 'Total Commands', value: info.total_commands_processed ? parseInt(info.total_commands_processed).toLocaleString() : '' },
        { label: 'Total Connections', value: info.total_connections_received ? parseInt(info.total_connections_received).toLocaleString() : '' },
        { label: 'Keyspace Hits', value: info.keyspace_hits ? parseInt(info.keyspace_hits).toLocaleString() : '' },
        { label: 'Keyspace Misses', value: info.keyspace_misses ? parseInt(info.keyspace_misses).toLocaleString() : '' },
        { label: 'Rejected Connections', value: info.rejected_connections || '' },
        { label: 'Expired Keys', value: info.expired_keys ? parseInt(info.expired_keys).toLocaleString() : '' },
        { label: 'Evicted Keys', value: info.evicted_keys ? parseInt(info.evicted_keys).toLocaleString() : '' },
      ],
    },
  ]

  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Server Status</h2>
          {info.redis_version && (
            <Badge variant="secondary" className="text-xs font-mono">
              v{info.redis_version}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchInfo} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section) => (
          <Card key={section.title} className="border-border/50">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                {section.icon}
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="space-y-1">
                {section.rows.filter(r => r.value).map((row) => (
                  <div key={row.label} className="flex justify-between items-center py-0.5 gap-2">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="text-xs font-mono text-right break-all">{row.value}</span>
                  </div>
                ))}
              </div>
              {section.extraContent}
            </CardContent>
          </Card>
        ))}
      </div>

      {info.keyspace && (
        <Card className="mt-4 border-border/50">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Database className="h-4 w-4" />
              Keyspace
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <pre className="text-xs font-mono text-muted-foreground">{info.keyspace}</pre>
          </CardContent>
        </Card>
      )}

      {configRows.length > 0 && (
        <Card className="mt-4 border-border/50">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Settings className="h-4 w-4" />
                All Redis Config
              </CardTitle>
              <Input
                placeholder="Search config..."
                value={configSearch}
                onChange={(e) => setConfigSearch(e.target.value)}
                className="h-7 w-48 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="border border-border/40 rounded-md overflow-hidden">
              <div className="grid grid-cols-2 bg-muted/40 px-3 py-1.5 border-b border-border/40">
                <span className="text-xs font-semibold text-muted-foreground">Key</span>
                <span className="text-xs font-semibold text-muted-foreground">Value</span>
              </div>
              <div className="divide-y divide-border/30">
                {configRows
                  .filter(r =>
                    !configSearch ||
                    r.key.toLowerCase().includes(configSearch.toLowerCase()) ||
                    r.value.toLowerCase().includes(configSearch.toLowerCase())
                  )
                  .map((r) => (
                    <div key={r.key} className="grid grid-cols-2 px-3 py-1.5 hover:bg-muted/20">
                      <span className="text-xs font-mono text-muted-foreground truncate pr-2">{r.key}</span>
                      <span className="text-xs font-mono break-all">{r.value}</span>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
