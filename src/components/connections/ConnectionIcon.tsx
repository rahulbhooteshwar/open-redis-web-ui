'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getConnectionDisplayName, getConnectionInitials, type StoredConnection } from '@/types/connection'
import { cn } from '@/lib/utils'

interface ConnectionIconProps {
  connection: StoredConnection
  className?: string
}

/** Generate a deterministic purple shade from a string */
function hashColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  const hue = 250 + (hash % 40) // 250-290 range (purple)
  const sat = 60 + (hash % 30) // 60-90%
  const lit = 45 + (hash % 20) // 45-65%
  return `hsl(${hue}, ${sat}%, ${lit}%)`
}

export function ConnectionIcon({ connection, className }: ConnectionIconProps) {
  const displayName = getConnectionDisplayName(connection)
  const bgColor = connection.color ?? hashColor(displayName)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'w-[38px] h-[38px] rounded-md flex items-center justify-center flex-shrink-0 cursor-pointer select-none',
            className,
          )}
          style={{ backgroundColor: bgColor }}
        >
          {connection.emoji ? (
            <span className="text-[1.2rem] leading-none">{connection.emoji}</span>
          ) : (
            <span className="text-sm font-bold text-white leading-none">
              {getConnectionInitials(connection)}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <span>{displayName}</span>
      </TooltipContent>
    </Tooltip>
  )
}
