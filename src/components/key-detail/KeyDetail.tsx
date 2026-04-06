'use client'

import { useCallback, useState } from 'react'
import { useTabsStore } from '@/store/tabs'
import { KeyHeader } from './KeyHeader'
import { KeyContentString } from './contents/KeyContentString'
import { KeyContentHash } from './contents/KeyContentHash'
import { KeyContentList } from './contents/KeyContentList'
import { KeyContentSet } from './contents/KeyContentSet'
import { KeyContentZset } from './contents/KeyContentZset'
import { KeyContentStream } from './contents/KeyContentStream'
import { KeyContentReJson } from './contents/KeyContentReJson'
import type { KeyTab } from '@/types/tab'

interface Props {
  tab: KeyTab
}

function decodeRedisKey(b64: string): string {
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return b64
  }
}

export function KeyDetail({ tab }: Props) {
  const { closeTab } = useTabsStore()
  const [keyName, setKeyName] = useState(() => decodeRedisKey(tab.redisKey))
  const [refreshKey, setRefreshKey] = useState(0)

  const handleDeleted = useCallback(() => {
    closeTab(tab.id)
  }, [closeTab, tab.id])

  const handleRenamed = useCallback((newName: string) => {
    setKeyName(newName)
  }, [])

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  function renderContent() {
    const props = { connectionKey: tab.connectionKey, keyName, key: refreshKey }
    switch (tab.keyType) {
      case 'string':
        return <KeyContentString {...props} />
      case 'hash':
        return <KeyContentHash {...props} />
      case 'list':
        return <KeyContentList {...props} />
      case 'set':
        return <KeyContentSet {...props} />
      case 'zset':
        return <KeyContentZset {...props} />
      case 'stream':
        return <KeyContentStream {...props} />
      case 'ReJSON-RL':
      case 'json':
        return <KeyContentReJson {...props} />
      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Unsupported key type: {tab.keyType}
          </div>
        )
    }
  }

  return (
    <div className="flex flex-col h-full">
      <KeyHeader
        connectionKey={tab.connectionKey}
        keyName={keyName}
        keyType={tab.keyType}
        onRenamed={handleRenamed}
        onDeleted={handleDeleted}
        onRefresh={handleRefresh}
      />
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  )
}
