import { createTunnel } from 'tunnel-ssh'
import type { ConnectionConfig, SSHOptions } from './redis-pool'

interface TunnelResult {
  localHost: string
  localPort: number
  dstHost: string
  dstPort: number
}

interface SSHConfig {
  tunnelOptions: any
  serverOptions: Record<string, unknown>
  sshOptions: Record<string, unknown>
  forwardOptions: { dstAddr: string; dstPort: number }
}

function resolvePrivateKey(value?: string): Buffer | undefined {
  if (!value) return undefined
  return Buffer.from(value.trim())
}

function getSSHOptions(options: SSHOptions, host: string, port: number): SSHConfig {
  return {
    tunnelOptions: { autoClose: false, reconnectOnError: false } as any,
    serverOptions: {},
    sshOptions: {
      host: options.host,
      port: options.port,
      username: options.username,
      password: options.password,
      privateKey: resolvePrivateKey(options.privatekey),
      passphrase: options.passphrase || undefined,
      readyTimeout: options.timeout && options.timeout > 0 ? options.timeout * 1000 : 30000,
      keepaliveInterval: 10000,
    },
    forwardOptions: {
      dstAddr: host,
      dstPort: port,
    },
  }
}

function getClusterNodes(nodes: string, type = 'master'): Array<{ host: string; port: number }> {
  const result: Array<{ host: string; port: number }> = []
  const lines = nodes.split('\n')
  for (let node of lines) {
    if (!node) continue
    const parts = node.trim().split(' ')
    if (parts[2]?.includes(type)) {
      const dsn = parts[1].split('@')[0]
      const lastIndex = dsn.lastIndexOf(':')
      const host = dsn.substring(0, lastIndex)
      const port = parseInt(dsn.substring(lastIndex + 1))
      result.push({ host, port })
    }
  }
  return result
}

function createClusterSSHTunnels(
  sshConfig: SSHConfig,
  nodes: Array<{ host: string; port: number }>,
): Promise<TunnelResult[]> {
  const sshTunnelStack = nodes.map((node) => {
    const sshConfigCopy = JSON.parse(JSON.stringify(sshConfig)) as SSHConfig
    if (sshConfigCopy.sshOptions.privateKey) {
      sshConfigCopy.sshOptions.privateKey = Buffer.from(sshConfigCopy.sshOptions.privateKey as any)
    }
    sshConfigCopy.forwardOptions.dstAddr = node.host
    sshConfigCopy.forwardOptions.dstPort = node.port

    return new Promise<TunnelResult>((resolve, reject) => {
      createTunnel(
        sshConfigCopy.tunnelOptions,
        sshConfigCopy.serverOptions,
        sshConfigCopy.sshOptions,
        sshConfigCopy.forwardOptions,
      ).then(([server]) => {
        const addr = (server as any).address() as { address: string; port: number }
        resolve({
          localHost: addr.address,
          localPort: addr.port,
          dstHost: node.host,
          dstPort: node.port,
        })
      }).catch(reject)
    })
  })

  return Promise.all(sshTunnelStack)
}

function initNatMap(tunnels: TunnelResult[]) {
  const natMap: Record<string, { host: string; port: number }> = {}
  for (const line of tunnels) {
    natMap[`${line.dstHost}:${line.dstPort}`] = { host: line.localHost, port: line.localPort }
  }
  return natMap
}

export const sshService = {
  createSSHConnection(
    options: SSHOptions,
    host: string,
    port: number,
    auth: string | undefined,
    config: ConnectionConfig,
    redisService: { createConnection: Function },
  ): Promise<unknown> {
    const sshOptionsDict = getSSHOptions(options, host, port)
    const configRaw = JSON.parse(JSON.stringify(config)) as ConnectionConfig
    const sshConfigRaw = JSON.parse(JSON.stringify(sshOptionsDict)) as SSHConfig

    return new Promise((resolve, reject) => {
      createTunnel(
        sshOptionsDict.tunnelOptions,
        sshOptionsDict.serverOptions,
        sshOptionsDict.sshOptions,
        sshOptionsDict.forwardOptions,
      ).then(([server]) => {
        const listenAddress = (server as any).address() as { address: string; port: number }

        if (configRaw.sentinelOptions) {
          const client = redisService.createConnection(
            listenAddress.address, listenAddress.port, auth, configRaw, false, true, true,
          )
          ;(client as any).on('ready', () => {
            ;(client as any).call('sentinel', 'get-master-addr-by-name', configRaw.sentinelOptions!.masterName)
              .then((reply: string[] | null) => {
                if (!reply) return reject(new Error(`Master name "${configRaw.sentinelOptions!.masterName}" not exists!`))
                createClusterSSHTunnels(sshConfigRaw, [{ host: reply[0], port: parseInt(reply[1]) }])
                  .then((tunnels) => {
                    const sentinelClient = redisService.createConnection(
                      tunnels[0].localHost, tunnels[0].localPort,
                      configRaw.sentinelOptions!.nodePassword, configRaw, false, true,
                    )
                    resolve(sentinelClient)
                  })
              }).catch(reject)
          })
          ;(client as any).on('error', reject)
        } else if (configRaw.cluster) {
          const client = redisService.createConnection(
            listenAddress.address, listenAddress.port, auth, configRaw, false, true,
          )
          ;(client as any).on('ready', () => {
            ;(client as any).call('cluster', 'nodes').then((reply: string) => {
              const nodes = getClusterNodes(reply)
              createClusterSSHTunnels(sshConfigRaw, nodes).then((tunnels) => {
                configRaw.natMap = initNatMap(tunnels)
                const clusterClient = redisService.createConnection(
                  tunnels[0].localHost, tunnels[0].localPort, auth, configRaw, false,
                )
                resolve(clusterClient)
              })
            }).catch(reject)
          })
          ;(client as any).on('error', reject)
        } else {
          const client = redisService.createConnection(
            listenAddress.address, listenAddress.port, auth, configRaw, false,
          )
          ;(client as any).once('ready', () => resolve(client))
          ;(client as any).once('error', (err: Error) => {
            ;(client as any).disconnect()
            reject(err)
          })
        }
      }).catch(reject)
    })
  },
}
