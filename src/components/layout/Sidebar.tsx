'use client'

import { Moon, Sun, Settings, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConnectionList } from '@/components/connections/ConnectionList'
import { NewConnectionDialog } from '@/components/connections/NewConnectionDialog'
import { SettingsDialog } from '@/components/layout/SettingsDialog'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [newConnOpen, setNewConnOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div
          className={cn(
            'flex items-center border-b border-sidebar-border px-2 py-2 flex-shrink-0',
            collapsed ? 'flex-col justify-center gap-1' : 'justify-between',
          )}
          style={{ minHeight: 48 }}
        >
          {collapsed ? (
            <>
              <Image
                src="/open-redis-web-ui.png"
                alt="Open Redis Web UI"
                width={40}
                height={40}
                className="flex-shrink-0 rounded-md"
                priority
              />
              {/* Collapse toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
                    onClick={onToggleCollapse}
                  >
                    <ChevronRight className="h-5 w-5 text-sidebar-foreground" strokeWidth={5} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand sidebar</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <Image
                  src="/open-redis-web-ui.png"
                  alt="Open Redis Web UI"
                  width={34}
                  height={34}
                  className="flex-shrink-0 rounded-md"
                  priority
                />
                <span className="text-[25px] font-semibold text-foreground truncate ">Open Redis Web UI</span>
              </div>

              {/* Collapse toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
                    onClick={onToggleCollapse}
                  >
                    <ChevronLeft className="h-5 w-5" strokeWidth={5} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Collapse sidebar</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* Connection list (scrollable) */}
        <ScrollArea className="flex-1 min-h-0">
          <ConnectionList collapsed={collapsed} onExpand={collapsed ? onToggleCollapse : undefined} />
        </ScrollArea>

        {/* Footer */}
        <div
          className={cn(
            'flex items-center border-t border-sidebar-border px-2 py-2 flex-shrink-0 gap-1',
            collapsed ? 'flex-col justify-center' : 'justify-between',
          )}
        >
          <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
            {/* Settings button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>

            {/* Theme toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
                  onClick={toggleTheme}
                >
                  {mounted ? (resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />) : <Moon className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {mounted && resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* New connection button */}
          <Tooltip>
            <TooltipTrigger asChild>

              {collapsed ?
                <Button
                  variant="outline"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => setNewConnOpen(true)}
                >
                  <Plus className="h-5 w-5" />
                </Button>
                :
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1 shrink-0 border-primary text-primary hover:bg-primary/10"
                  onClick={() => setNewConnOpen(true)}
                >
                  <Plus className="h-5 w-5" />
                  <span className="ml-1">New Connection</span>
                </Button>
              }

            </TooltipTrigger>
            {
              collapsed &&
              <TooltipContent side="right">
                Add New connection
              </TooltipContent>
            }

          </Tooltip>
        </div>
      </div>

      <NewConnectionDialog open={newConnOpen} onOpenChange={setNewConnOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </TooltipProvider>
  )
}
