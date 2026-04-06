'use client'

/**
 * ws-client.ts
 *
 * WebSocket singleton for the browser. Handles:
 * - One-shot request/response (nanoid correlation IDs)
 * - Push stream subscriptions (cli/monitor/subscribe/psubscribe)
 * - Auto-reconnect with exponential backoff
 * - Ping/pong keepalive every 30 seconds
 */

type StreamHandler = (data: unknown) => void

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

type StreamKey = `${string}:${string}` // `${connectionKey}:${type}`

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

class WsClient {
  private ws: WebSocket | null = null
  private pending = new Map<string, PendingRequest>()
  private streamListeners = new Map<StreamKey, Set<StreamHandler>>()
  private reconnectAttempt = 0
  private maxReconnectDelay = 30_000
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false
  private connected = false

  constructor() {
    if (typeof window !== 'undefined') {
      this.connect()
    }
  }

  private getWsUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}/ws`
  }

  private connect() {
    if (this.destroyed) return
    try {
      this.ws = new WebSocket(this.getWsUrl())
      this.ws.onopen = this.handleOpen
      this.ws.onmessage = this.handleMessage
      this.ws.onclose = this.handleClose
      this.ws.onerror = this.handleError
    } catch {
      this.scheduleReconnect()
    }
  }

  private handleOpen = () => {
    this.connected = true
    this.reconnectAttempt = 0
    this.startPing()
  }

  private handleMessage = (ev: MessageEvent) => {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(ev.data as string)
    } catch {
      return
    }

    // Pong response
    if (msg.type === 'pong') return

    // One-shot response: has a correlation id
    if (msg.id && typeof msg.id === 'string') {
      const pending = this.pending.get(msg.id)
      if (pending) {
        this.pending.delete(msg.id)
        if (msg.error) {
          pending.reject(new Error((msg.message as string) || 'WS error'))
        } else {
          pending.resolve(msg.result ?? msg)
        }
        return
      }
    }

    // Push stream message: has connectionKey + type
    if (msg.connectionKey && msg.type) {
      const key: StreamKey = `${msg.connectionKey}:${msg.type}`
      const handlers = this.streamListeners.get(key)
      if (handlers) {
        handlers.forEach((fn) => fn(msg.data ?? msg))
      }
    }
  }

  private handleClose = () => {
    this.connected = false
    this.stopPing()
    // Reject all pending requests
    this.pending.forEach(({ reject }) =>
      reject(new Error('WebSocket connection closed')),
    )
    this.pending.clear()
    this.scheduleReconnect()
  }

  private handleError = () => {
    // onclose will fire after onerror, so we just log here
  }

  private scheduleReconnect() {
    if (this.destroyed) return
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    const delay = Math.min(
      500 * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay,
    )
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private startPing() {
    if (this.pingTimer) clearInterval(this.pingTimer)
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30_000)
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private send(msg: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }
    this.ws.send(JSON.stringify(msg))
  }

  /**
   * Send a request and await the correlated response.
   */
  sendRequest(msg: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = generateId()
      this.pending.set(id, { resolve, reject })
      try {
        this.send({ ...msg, id })
      } catch (e) {
        this.pending.delete(id)
        reject(e)
      }
    })
  }

  /**
   * Register a push-stream listener for (connectionKey, type) pairs.
   * Used for CLI output, monitor output, pub/sub messages.
   */
  addStreamListener(connectionKey: string, type: string, handler: StreamHandler) {
    const key: StreamKey = `${connectionKey}:${type}`
    let set = this.streamListeners.get(key)
    if (!set) {
      set = new Set()
      this.streamListeners.set(key, set)
    }
    set.add(handler)
  }

  removeStreamListener(connectionKey: string, type: string, handler: StreamHandler) {
    const key: StreamKey = `${connectionKey}:${type}`
    const set = this.streamListeners.get(key)
    if (set) {
      set.delete(handler)
      if (set.size === 0) this.streamListeners.delete(key)
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  destroy() {
    this.destroyed = true
    this.stopPing()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
    }
  }
}

// Singleton — created lazily on first import in browser context
let _wsClient: WsClient | null = null

export function getWsClient(): WsClient {
  if (!_wsClient) {
    _wsClient = new WsClient()
  }
  return _wsClient
}

// Named export for convenience
export const wsClient = {
  sendRequest: (msg: Record<string, unknown>) => getWsClient().sendRequest(msg),
  addStreamListener: (connectionKey: string, type: string, handler: StreamHandler) =>
    getWsClient().addStreamListener(connectionKey, type, handler),
  removeStreamListener: (connectionKey: string, type: string, handler: StreamHandler) =>
    getWsClient().removeStreamListener(connectionKey, type, handler),
  isConnected: () => getWsClient().isConnected(),
}
