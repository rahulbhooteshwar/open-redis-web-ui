import { NextRequest, NextResponse } from 'next/server'
import { getConnections, setConnections } from '@/lib/server/storage'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const connections = getConnections()
    if (!connections[key]) {
      return NextResponse.json({ error: true, message: 'Connection not found' }, { status: 404 })
    }
    const body = await req.json()
    const conn = connections[key] as unknown as Record<string, unknown>
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (v === null) {
        delete conn[k]
      } else {
        conn[k] = v
      }
    }
    setConnections(connections)
    return NextResponse.json(connections[key])
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const connections = getConnections()
    if (!connections[key]) {
      return NextResponse.json({ error: true, message: 'Connection not found' }, { status: 404 })
    }
    delete connections[key]
    setConnections(connections)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
