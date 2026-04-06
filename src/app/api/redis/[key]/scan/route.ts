import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'
import type Redis from 'ioredis'

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor') || '0'
    const match = searchParams.get('match') || '*'
    const count = searchParams.get('count') || '200'
    const scanType = searchParams.get('scanType') || null
    const scanKey = searchParams.get('scanKey') || null
    const scanKeyEncoding = searchParams.get('scanKeyEncoding') || null

    const client = redisPool.getClient(key) as Redis

    let nextCursor: string | Buffer
    let items: (string | Buffer)[]

    if (scanType && scanKey) {
      const resolvedKey = scanKeyEncoding === 'latin1'
        ? Buffer.from(scanKey, 'latin1')
        : scanKey
      ;[nextCursor, items] = await (client as any)[scanType](
        resolvedKey, cursor, 'MATCH', match, 'COUNT', parseInt(count),
      )
    } else {
      ;[nextCursor, items] = await client.scan(cursor, 'MATCH', match, 'COUNT', parseInt(count))
    }

    const encoded = items.map(i => Buffer.isBuffer(i) ? i.toString('base64') : Buffer.from(String(i)).toString('base64'))
    const cursorStr = Buffer.isBuffer(nextCursor) ? nextCursor.toString() : String(nextCursor)
    return NextResponse.json({ cursor: cursorStr, items: encoded })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
