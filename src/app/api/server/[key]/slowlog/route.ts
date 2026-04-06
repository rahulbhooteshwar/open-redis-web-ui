import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'
import type Redis from 'ioredis'

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const { searchParams } = new URL(req.url)
    const count = parseInt(searchParams.get('count') || '128')
    const client = redisPool.getClient(key) as Redis
    const log = await (client as any).call('slowlog', 'get', count)
    return NextResponse.json({ log })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
