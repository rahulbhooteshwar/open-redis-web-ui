'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Square, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MonacoEditor } from '@/components/shared/MonacoEditor'
import { wsClient } from '@/lib/ws-client'
import { splitargs } from '@/lib/splitargs'
import { COMMAND_NAMES, REDIS_COMMANDS } from '@/lib/commands'
import type { CliTab as CliTabType } from '@/types/tab'
import { cn } from '@/lib/utils'

interface Props { tab: CliTabType }

const MAX_LINES = 2000
const HISTORY_KEY = 'orwui-cli-history'

function loadHistory(connectionKey: string): string[] {
  try {
    const raw = localStorage.getItem(`${HISTORY_KEY}-${connectionKey}`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHistory(connectionKey: string, history: string[]) {
  try {
    localStorage.setItem(`${HISTORY_KEY}-${connectionKey}`, JSON.stringify(history.slice(-500)))
  } catch { /* ignore */ }
}

function formatResult(result: unknown, depth = 0): string {
  if (result === null || result === undefined) return '(nil)'
  if (typeof result === 'string') return result
  if (typeof result === 'number') return String(result)
  if (typeof result === 'boolean') return result ? 'OK' : '0'
  if (Array.isArray(result)) {
    if (result.length === 0) return '(empty array)'
    return result.map((item, i) => `${i + 1}) ${formatResult(item, depth + 1)}`).join('\n')
  }
  return JSON.stringify(result)
}

export function CliTab({ tab }: Props) {
  const [output, setOutput] = useState<string>('# Redis CLI — type a command and press Enter\n# Type "clear" to clear, "monitor" to start monitoring\n\n')
  const [input, setInput] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const history = useRef<string[]>(loadHistory(tab.connectionKey))
  const outputRef = useRef(output)
  outputRef.current = output

  const appendOutput = useCallback((text: string) => {
    setOutput((prev) => {
      const lines = prev.split('\n')
      if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES)
      return [...lines, text].join('\n')
    })
  }, [])

  // Monitor stream listener
  useEffect(() => {
    const handler = (data: unknown) => {
      const msg = data as { type: string; time?: number; args?: string[]; channel?: string; message?: string; pattern?: string }
      if (msg.type === 'monitor') {
        const ts = msg.time ? new Date(msg.time * 1000).toISOString().slice(11, 23) : ''
        const args = (msg.args || []).join(' ')
        appendOutput(`[${ts}] ${args}`)
      } else if (msg.type === 'message') {
        appendOutput(`message: ${msg.channel} → ${msg.message}`)
      } else if (msg.type === 'pmessage') {
        appendOutput(`pmessage: [${msg.pattern}] ${msg.channel} → ${msg.message}`)
      }
    }

    wsClient.addStreamListener(tab.connectionKey, 'monitor', handler)
    wsClient.addStreamListener(tab.connectionKey, 'message', handler)
    wsClient.addStreamListener(tab.connectionKey, 'pmessage', handler)

    return () => {
      wsClient.removeStreamListener(tab.connectionKey, 'monitor', handler)
      wsClient.removeStreamListener(tab.connectionKey, 'message', handler)
      wsClient.removeStreamListener(tab.connectionKey, 'pmessage', handler)
    }
  }, [tab.connectionKey, appendOutput])

  const execCommand = useCallback(async (cmdLine: string) => {
    const trimmed = cmdLine.trim()
    if (!trimmed) return

    // Add to history
    history.current = [trimmed, ...history.current.filter((h) => h !== trimmed)].slice(0, 500)
    saveHistory(tab.connectionKey, history.current)
    setHistoryIndex(-1)

    appendOutput(`> ${trimmed}`)
    setInput('')
    setShowSuggestions(false)

    const lower = trimmed.toLowerCase()

    // Built-in commands
    if (lower === 'clear') {
      setOutput('# Cleared\n\n')
      return
    }

    if (lower === 'monitor') {
      try {
        await wsClient.sendRequest({ type: 'monitor', connectionKey: tab.connectionKey })
        setIsMonitoring(true)
        appendOutput('Monitoring started. Click Stop to end.')
      } catch (e: any) {
        appendOutput(`(error) ${e.message}`)
      }
      return
    }

    if (lower.startsWith('subscribe ') || lower === 'subscribe') {
      const channels = splitargs(trimmed).slice(1)
      try {
        await wsClient.sendRequest({ type: 'subscribe', connectionKey: tab.connectionKey, channels })
        setIsSubscribed(true)
        appendOutput(`Subscribed to: ${channels.join(', ')}`)
      } catch (e: any) {
        appendOutput(`(error) ${e.message}`)
      }
      return
    }

    if (lower.startsWith('psubscribe ')) {
      const patterns = splitargs(trimmed).slice(1)
      try {
        await wsClient.sendRequest({ type: 'psubscribe', connectionKey: tab.connectionKey, channels: patterns })
        setIsSubscribed(true)
        appendOutput(`PSubscribed to: ${patterns.join(', ')}`)
      } catch (e: any) {
        appendOutput(`(error) ${e.message}`)
      }
      return
    }

    // Generic command via WebSocket
    try {
      const parts = splitargs(trimmed)
      const command = parts[0]
      const args = parts.slice(1)
      const result = await wsClient.sendRequest({
        type: 'cli',
        connectionKey: tab.connectionKey,
        command,
        args,
      })
      appendOutput(formatResult(result))
    } catch (e: any) {
      appendOutput(`(error) ${e.message}`)
    }
  }, [tab.connectionKey, appendOutput])

  const stopMonitor = useCallback(async () => {
    try {
      await wsClient.sendRequest({ type: 'monitor_stop', connectionKey: tab.connectionKey })
      setIsMonitoring(false)
      appendOutput('Monitor stopped.')
    } catch { /* ignore */ }
  }, [tab.connectionKey, appendOutput])

  const stopSubscribe = useCallback(async () => {
    try {
      await wsClient.sendRequest({ type: 'unsubscribe', connectionKey: tab.connectionKey, channels: [] })
      setIsSubscribed(false)
      appendOutput('Unsubscribed.')
    } catch { /* ignore */ }
  }, [tab.connectionKey, appendOutput])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      execCommand(input)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const newIdx = Math.min(historyIndex + 1, history.current.length - 1)
      setHistoryIndex(newIdx)
      if (history.current[newIdx]) setInput(history.current[newIdx])
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const newIdx = Math.max(historyIndex - 1, -1)
      setHistoryIndex(newIdx)
      setInput(newIdx === -1 ? '' : history.current[newIdx] || '')
      return
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }, [execCommand, historyIndex, input])

  const handleInputChange = useCallback((v: string) => {
    setInput(v)
    // Show command suggestions
    if (v && !v.includes(' ')) {
      const upper = v.toUpperCase()
      const matches = COMMAND_NAMES.filter((c) => c.startsWith(upper)).slice(0, 8)
      setSuggestions(matches)
      setShowSuggestions(matches.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }, [])

  const selectedSuggestion = suggestions.find((s) => s === input.toUpperCase())
  const suggestionHint = !selectedSuggestion && input && !input.includes(' ')
    ? REDIS_COMMANDS[input.toUpperCase()]?.args
    : null

  return (
    <div className="flex flex-col h-full font-mono">
      {/* Output area */}
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          value={output}
          language="plaintext"
          readOnly
          wordWrap="on"
          fontSize={12}
          minimap={false}
        />
      </div>

      {/* Status bar */}
      {(isMonitoring || isSubscribed) && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border bg-muted/30">
          <Badge variant="destructive" className="text-xs animate-pulse">
            {isMonitoring ? 'MONITORING' : 'SUBSCRIBED'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={isMonitoring ? stopMonitor : stopSubscribe}
          >
            <Square className="h-3 w-3 mr-1" />
            Stop
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-2 relative">
        {showSuggestions && (
          <div className="absolute bottom-full left-2 right-2 bg-popover border border-border rounded-md shadow-lg overflow-hidden z-10">
            {suggestions.map((s) => (
              <div
                key={s}
                className="px-3 py-1 text-xs hover:bg-accent cursor-pointer"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setInput(s + ' ')
                  setShowSuggestions(false)
                }}
              >
                <span className="font-semibold">{s}</span>
                <span className="text-muted-foreground ml-2 text-[10px]">
                  {REDIS_COMMANDS[s]?.args}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <Input
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isMonitoring ? 'Monitoring active...' : 'Enter Redis command...'}
            disabled={isMonitoring}
            className="h-7 text-xs font-mono border-0 focus-visible:ring-0 px-0 bg-transparent"
            autoComplete="off"
            spellCheck={false}
          />
          {suggestionHint && (
            <span className="text-muted-foreground/50 text-[10px] truncate flex-shrink-0 max-w-48">
              {input.toUpperCase()} {suggestionHint}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
