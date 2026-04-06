import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'
import type Redis from 'ioredis'

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const { searchParams } = new URL(req.url)
    const keyName = searchParams.get('keyName')
    const type = searchParams.get('type')

    if (!keyName) {
      return NextResponse.json({ error: true, message: 'keyName required' }, { status: 400 })
    }

    const client = redisPool.getClient(key) as Redis
    const resolvedType = type || await client.type(keyName)
    let value: unknown

    switch (resolvedType) {
      case 'string':
        value = await client.get(keyName)
        break
      case 'list':
        value = await client.lrange(keyName, 0, -1)
        break
      case 'set':
        value = await client.smembers(keyName)
        break
      case 'zset':
        value = await (client as any).zrange(keyName, 0, -1, 'WITHSCORES')
        break
      case 'hash':
        value = await client.hgetall(keyName)
        break
      case 'stream':
        value = await (client as any).xrange(keyName, '-', '+')
        break
      default:
        return NextResponse.json({ error: true, message: `Unsupported type: ${resolvedType}` }, { status: 400 })
    }

    return NextResponse.json({ type: resolvedType, value })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
