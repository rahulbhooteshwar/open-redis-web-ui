import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'
import type Redis from 'ioredis'

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const { searchParams } = new URL(req.url)
    const keyName = searchParams.get('keyName')
    if (!keyName) {
      return NextResponse.json({ error: true, message: 'keyName required' }, { status: 400 })
    }
    const client = redisPool.getClient(key) as Redis
    const [ttl, pttl] = await Promise.all([client.ttl(keyName), client.pttl(keyName)])
    return NextResponse.json({ ttl: Number(ttl), pttl: Number(pttl) })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
