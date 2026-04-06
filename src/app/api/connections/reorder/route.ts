import { NextRequest, NextResponse } from 'next/server'
import { getConnections, setConnections, buildConnectionKey } from '@/lib/server/storage'
import type { StoredConnection } from '@/lib/server/storage'

export async function POST(req: NextRequest) {
  try {
    const list: StoredConnection[] = await req.json()
    if (!Array.isArray(list)) {
      return NextResponse.json({ error: true, message: 'body must be an array' }, { status: 400 })
    }

    const newConnections: Record<string, StoredConnection> = {}
    list.forEach((connection, index) => {
      connection.order = index
      const key = connection.key || buildConnectionKey()
      connection.key = key
      newConnections[key] = connection
    })

    setConnections(newConnections)
    return NextResponse.json(newConnections)
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
