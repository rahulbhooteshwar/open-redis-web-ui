import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'
import type Redis from 'ioredis'

export async function POST(req: NextRequest) {
  let key: string | undefined
  try {
    const config = await req.json()
    key = await redisPool.connect(config)
    const client = redisPool.getClient(key) as Redis
    await client.ping()
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: true, success: false, message: e.message }, { status: 500 })
  } finally {
    if (key) await redisPool.disconnect(key).catch(() => {})
  }
}
