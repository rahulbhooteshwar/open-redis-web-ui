import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'
import type Redis from 'ioredis'

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const { keyName, newKeyName } = await req.json()
    if (!keyName || !newKeyName) {
      return NextResponse.json({ error: true, message: 'keyName and newKeyName required' }, { status: 400 })
    }
    const client = redisPool.getClient(key) as Redis
    await client.rename(keyName, newKeyName)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
