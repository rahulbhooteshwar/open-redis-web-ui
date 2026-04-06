import { NextRequest, NextResponse } from 'next/server'
import { getConnectionsList, getConnections, setConnections, buildConnectionKey } from '@/lib/server/storage'

export async function GET() {
  try {
    const list = getConnectionsList()
    return NextResponse.json(list)
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const connection = await req.json()
    if (!connection?.host) {
      return NextResponse.json({ error: true, message: 'host is required' }, { status: 400 })
    }

    const connections = getConnections()
    const key = buildConnectionKey()
    connection.key = key

    if (isNaN(connection.order)) {
      const maxOrder = Math.max(0, ...Object.values(connections).map(c => (!isNaN(c.order) ? c.order : 0)))
      connection.order = maxOrder + 1
    }

    connections[key] = connection
    setConnections(connections)
    return NextResponse.json(connection, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
