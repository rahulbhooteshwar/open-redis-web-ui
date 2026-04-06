import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'
import type Redis from 'ioredis'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const client = redisPool.getClient(key) as Redis

    // INFO keyspace is always available; CONFIG may be disabled on managed Redis
    const keyspace = await client.info('keyspace')

    let dbconfig: string[]
    try {
      dbconfig = await (client as any).config('get', 'databases')
    } catch {
      // CONFIG disabled (common on managed/cloud Redis) — default to 16 DBs
      dbconfig = ['databases', '16']
    }

    return NextResponse.json({ dbconfig, keyspace })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
