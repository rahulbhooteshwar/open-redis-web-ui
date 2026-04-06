import { WebSocketServer, WebSocket } from 'ws'
import { redisPool } from './redis-pool'
import type Redis from 'ioredis'

function send(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

function sendError(ws: WebSocket, message: string, id?: string): void {
  send(ws, { type: 'error', id, message })
}

export function wsHandler(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket) => {
    let monitorClient: Redis | null = null
    let pubsubClient: Redis | null = null

    ws.on('message', async (raw) => {
      let msg: Record<string, any>
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return sendError(ws, 'Invalid JSON')
      }

      const { type, connectionKey, id } = msg

      if (!connectionKey && type !== 'ping') {
        return sendError(ws, 'connectionKey required', id)
      }

      try {
        switch (type) {
          case 'ping':
            send(ws, { type: 'pong', id })
            break

          case 'cli': {
            const { command, args = [] } = msg
            const client = redisPool.getClient(connectionKey) as Redis
            const result = await (client as any).callBuffer(command, args)
            send(ws, { type: 'cli', id, result: result === null ? null : result.toString() })
            break
          }

          case 'monitor': {
            const client = redisPool.getClient(connectionKey) as Redis
            if (monitorClient) {
              try { monitorClient.disconnect() } catch { /* ignore */ }
            }
            monitorClient = await (client as any).monitor()
            ;(monitorClient as any).on('monitor', (time: number, args: string[], source: string, database: number) => {
              send(ws, { type: 'monitor', time, args, source, database })
            })
            send(ws, { type: 'monitor_started', id })
            break
          }

          case 'monitor_stop': {
            if (monitorClient) {
              try { monitorClient.disconnect() } catch { /* ignore */ }
              monitorClient = null
            }
            send(ws, { type: 'monitor_stopped', id })
            break
          }

          case 'subscribe':
          case 'psubscribe': {
            const { channels = [] } = msg
            const client = redisPool.getClient(connectionKey) as Redis

            if (!pubsubClient) {
              pubsubClient = client.duplicate()
              pubsubClient.on('message', (channel, message) => {
                send(ws, { type: 'message', channel, message })
              })
              pubsubClient.on('pmessage', (pattern, channel, message) => {
                send(ws, { type: 'pmessage', pattern, channel, message })
              })
            }

            await (pubsubClient as any)[type](channels)
            send(ws, { type: `${type}_ok`, id, channels })
            break
          }

          case 'unsubscribe':
          case 'punsubscribe': {
            if (pubsubClient) {
              const { channels = [] } = msg
              await (pubsubClient as any)[type](channels.length ? channels : undefined)
            }
            send(ws, { type: `${type}_ok`, id })
            break
          }

          default:
            sendError(ws, `Unknown message type: ${type}`, id)
        }
      } catch (e: any) {
        sendError(ws, e.message, id)
      }
    })

    ws.on('close', () => {
      if (monitorClient) {
        try { monitorClient.disconnect() } catch { /* ignore */ }
        monitorClient = null
      }
      if (pubsubClient) {
        try { pubsubClient.disconnect() } catch { /* ignore */ }
        pubsubClient = null
      }
    })
  })
}
