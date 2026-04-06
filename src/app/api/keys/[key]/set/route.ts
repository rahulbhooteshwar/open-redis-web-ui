import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'
import type Redis from 'ioredis'

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const { keyName, type, value, ttl } = await req.json()

    if (!keyName || !type) {
      return NextResponse.json({ error: true, message: 'keyName and type required' }, { status: 400 })
    }

    const client = redisPool.getClient(key) as Redis

    switch (type) {
      case 'string':
        await client.set(keyName, value)
        break
      case 'list':
        await client.del(keyName)
        if (Array.isArray(value) && value.length) await client.rpush(keyName, ...value)
        break
      case 'set':
        await client.del(keyName)
        if (Array.isArray(value) && value.length) await client.sadd(keyName, ...value)
        break
      case 'zset': {
        await client.del(keyName)
        if (Array.isArray(value) && value.length) {
          const args: string[] = []
          for (const item of value) { args.push(item.score, item.member) }
          await (client as any).zadd(keyName, ...args)
        }
        break
      }
      case 'hash': {
        await client.del(keyName)
        if (Array.isArray(value) && value.length) {
          const args: string[] = []
          for (const [field, val] of value) { args.push(field, val) }
          await client.hset(keyName, ...args)
        }
        break
      }
      default:
        return NextResponse.json({ error: true, message: `Unsupported type: ${type}` }, { status: 400 })
    }

    if (ttl && ttl > 0) await client.expire(keyName, ttl)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
