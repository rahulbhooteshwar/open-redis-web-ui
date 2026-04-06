import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'
import type Redis from 'ioredis'

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const { keyName, ttl } = await req.json()
    if (!keyName) {
      return NextResponse.json({ error: true, message: 'keyName required' }, { status: 400 })
    }
    const client = redisPool.getClient(key) as Redis
    if (ttl === -1 || ttl === null || ttl === undefined) {
      await client.persist(keyName)
    } else {
      await client.expire(keyName, ttl)
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
