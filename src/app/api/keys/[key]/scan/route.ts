import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'
import type Redis from 'ioredis'

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor') || '0'
    const match = searchParams.get('match') || '*'
    const count = parseInt(searchParams.get('count') || '200')

    const client = redisPool.getClient(key) as Redis
    const [nextCursor, keys] = await client.scan(cursor, 'MATCH', match, 'COUNT', count)
    return NextResponse.json({ cursor: nextCursor, keys })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
