'use client'

import { useTheme } from 'next-themes'
import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'

// Monaco must be dynamically imported to avoid SSR issues
const Editor = dynamic(
  () => import('@monaco-editor/react').then((m) => m.default),
  { ssr: false, loading: () => <div className="h-full bg-muted/20 animate-pulse" /> },
)

interface MonacoEditorProps {
  value?: string
  onChange?: (value: string) => void
  language?: string
  readOnly?: boolean
  height?: string
  minimap?: boolean
  wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded'
  fontSize?: number
}

export function MonacoEditor({
  value = '',
  onChange,
  language = 'plaintext',
  readOnly = false,
  height = '100%',
  minimap = false,
  wordWrap = 'on',
  fontSize = 12,
}: MonacoEditorProps) {
  const { resolvedTheme } = useTheme()
  const monacoTheme = resolvedTheme === 'dark' ? 'orwui-dark' : 'orwui-light'
  const themeRegistered = useRef(false)

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme={monacoTheme}
      options={{
        readOnly,
        minimap: { enabled: minimap },
        wordWrap,
        fontSize,
        lineNumbers: language !== 'plaintext' ? 'on' : 'off',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
        padding: { top: 8, bottom: 8 },
        renderLineHighlight: 'none',
        overviewRulerLanes: 0,
        contextmenu: true,
        cursorBlinking: 'smooth',
      }}
      onChange={(v) => onChange?.(v || '')}
      beforeMount={(monaco) => {
        if (themeRegistered.current) return
        themeRegistered.current = true
        monaco.editor.defineTheme('orwui-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [],
          colors: {
            'editor.background': '#25293A',
            'editor.foreground': '#f8f8f2',
            'editorLineNumber.foreground': '#4a4a5a',
            'editor.selectionBackground': '#6d28d940',
            'editor.lineHighlightBackground': '#ffffff08',
          },
        })
        monaco.editor.defineTheme('orwui-light', {
          base: 'vs',
          inherit: true,
          rules: [],
          colors: {
            'editor.background': '#ffffff',
            'editor.foreground': '#1e1e2e',
            'editorLineNumber.foreground': '#a0a0b0',
            'editor.selectionBackground': '#7c3aed20',
            'editor.lineHighlightBackground': '#00000008',
          },
        })
      }}
    />
  )
}
